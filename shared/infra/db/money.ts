import { Money, Round, findCurrency, Decimal } from "@lib/money";

/**
 * Representasi nilai uang di database (SQLite/D1).
 *
 * Aturan penyimpanannya:
 *
 * - **Tabel yang punya kolom `currency`** (mis. `asset`, `asset_mutation`):
 *   nominal disimpan sebagai **minor unit** — satuan terkecil mata uang —
 *   di kolom `INTEGER`, jadi presisi penuh tanpa floating point. Kode mata
 *   uangnya tetap dibaca dari kolom `currency`.
 * - **Tabel tanpa kolom `currency`** (mis. `transaction`): instance `Money`
 *   diserialisasi penuh sebagai string `"KODE NOMINAL"` di kolom `TEXT`
 *   (hasil `serializeMoney`, mis. `"IDR 1500000"`).
 *
 * Dengan begitu nilai yang tersimpan selalu bisa dipulihkan jadi instance
 * `Money` tanpa perlu menebak format teksnya.
 */

/** Instance `Money` -> minor unit (satuan terkecil) untuk kolom INTEGER. */
export function toMinorUnits(money: Money): bigint {
  return money.round(money.currency.exponent, Round.HalfUp).toMinorUnits();
}

/**
 * Minor unit + kode mata uang -> instance `Money`.
 *
 * @throws {Error} Kalau kode mata uangnya tidak dikenal.
 */
export function fromMinorUnits(minor: bigint | number, currencyCode: string): Money {
  const currency = findCurrency(currencyCode);
  if (!currency) {
    throw new Error(`Unknown currency: ${currencyCode}`);
  }
  const value = typeof minor === "bigint" ? minor : BigInt(Math.trunc(minor));
  return Money.fromMinor(value, currency);
}

/** Instance `Money` -> string `"KODE NOMINAL"` untuk kolom TEXT, mis. `"IDR 1500000"`. */
export function serializeMoney(money: Money): string {
  return `${money.currency.code} ${money.toNumber()}`;
}

/**
 * String `"KODE NOMINAL"` di kolom TEXT -> instance `Money`.
 *
 * Format sama dengan wire format scalar GraphQL `Money`: `"KODE ISO NOMINAL"`,
 * mis. `"IDR 1500000"` atau `"USD 100.5"`.
 *
 * @throws {Error} Kalau formatnya salah atau kodenya bukan mata uang yang dikenal.
 */
export function deserializeMoney(raw: string): Money {
  const match = raw.trim().match(/^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/);
  if (!match) {
    throw new Error(
      `Invalid money format: "${raw}". Expected "ISO_CODE VALUE" (e.g. "IDR 1500000")`,
    );
  }

  const [, code, rawAmount] = match;
  const currency = findCurrency(code);
  if (!currency) {
    throw new Error(`Unknown currency: ${code}`);
  }

  const decimal = Decimal.fromString(rawAmount.replace(/,/g, ""));
  if (!decimal) {
    throw new Error(`Invalid money amount: "${rawAmount}"`);
  }

  // Kanonikkan ke skala mata uangnya, supaya instance `Money` dari DB selalu
  // punya bentuk yang sama dengan yang dikirim lewat wire / domain.
  const rounded = Money.fromDecimal(decimal, currency).round(currency.exponent, Round.HalfUp);
  return Money.fromMinor(rounded.toMinorUnits(), currency);
}
