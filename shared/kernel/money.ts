import { Decimal, Money, Round, isoCurrencies, type Currency } from "@lib/money";

/**
 * Kode ISO 4217 yang tidak bisa dipakai sebagai saldo.
 *
 * `XXX` berarti "tanpa mata uang", sedangkan kode `XBA`..`XBD`, `XDR`, `XSU`,
 * `XTS`, `XUA` dan `XAD` adalah unit akun / kode uji, bukan mata uang yang
 * bisa dibelanjakan.
 */
const NON_SPENDABLE_ISO_CODES: ReadonlySet<string> = new Set([
  "XAD",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);

/** Kode ISO 4217 yang bisa disimpan sebagai saldo. */
export const isoCodeList: string[] = Object.keys(isoCurrencies).filter(
  (code) => !NON_SPENDABLE_ISO_CODES.has(code),
);

const spendableIsoCodes: ReadonlySet<string> = new Set(isoCodeList);

/** Format nominal uang: "KODE NOMINAL", mis. "USD 100" atau "IDR 1,000,000". */
const MONEY_PATTERN = /^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/;

/**
 * Mencari mata uang yang bisa dipakai sebagai saldo.
 *
 * @throws {Error} Kalau kodenya bukan ISO 4217 yang bisa dibelanjakan.
 */
export function findSpendableCurrency(code: string): Currency {
  const currency = isoCurrencies[code];
  if (!currency || !spendableIsoCodes.has(code)) {
    throw new Error(`Currency must be a 3-letter code: ${code}`);
  }
  return currency;
}

/**
 * Parse nominal uang berformat "KODE NOMINAL" menjadi {@link Money}.
 *
 * Nominal dibulatkan ke satuan terkecil mata uang dengan pembulatan
 * {@link Round.HalfUp} (midpoint menjauhi nol).
 *
 * @throws {Error} Kalau formatnya salah atau kodenya bukan mata uang yang
 * bisa dibelanjakan.
 */
export function parseMoney(value: string): Money {
  const match = value.trim().match(MONEY_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid balance format: "${value}". Expected "ISO_CODE VALUE" (e.g. "USD 100")`,
    );
  }

  const [, isoCode, rawAmount] = match;
  const currency = findSpendableCurrency(isoCode);
  const amount = parseFloat(rawAmount.replace(/,/g, ""));

  const rounded = Money.fromDecimal(Decimal.fromNumber(amount), currency).round(
    currency.exponent,
    Round.HalfUp,
  );

  return Money.fromMinor(rounded.toMinorUnits(), currency);
}

/** Format {@link Money} menjadi "KODE NOMINAL", mis. "USD 100". */
export function formatMoney(money: Money): string {
  return `${money.currency.code} ${money.toNumber()}`;
}
