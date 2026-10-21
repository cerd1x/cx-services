import { Decimal } from "./decimal";
import { isoCurrencies, type Currency } from "./currency";
import { Money } from "./money";
import { Round } from "./round";

/**
 * ISO-4217 codes that must not be used to store a spendable balance.
 *
 * `XXX` means "no currency", while `XBA`..`XBD`, `XDR`, `XSU`, `XTS`, `XUA`
 * and `XAD` are unit/account/test codes rather than currencies that can be
 * spent.
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

/** ISO-4217 codes that can be stored as a spendable balance. */
export const isoCodeList: string[] = Object.keys(isoCurrencies).filter(
  (code) => !NON_SPENDABLE_ISO_CODES.has(code),
);

const spendableIsoCodes: ReadonlySet<string> = new Set(isoCodeList);

/** Format of a money literal: "ISO_CODE VALUE", e.g. "USD 100". */
const MONEY_PATTERN = /^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/;

/**
 * Looks up a currency that can be stored as a spendable balance.
 *
 * @throws {Error} When the code is not a spendable ISO-4217 code.
 */
export function findSpendableCurrency(code: string): Currency {
  const currency = isoCurrencies[code];
  if (!currency || !spendableIsoCodes.has(code)) {
    throw new Error(`Currency must be a 3-letter code: ${code}`);
  }
  return currency;
}

/**
 * Parses a money literal of the form "ISO_CODE VALUE" into a {@link Money}.
 *
 * The amount is rounded to the smallest unit of the currency using
 * {@link Round.HalfUp} (midpoints away from zero).
 *
 * @throws {Error} When the literal is malformed or the code is not a
 * spendable ISO-4217 code.
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

/**
 * Renders a {@link Money} as "ISO_CODE VALUE", e.g. "USD 100".
 */
export function formatMoney(money: Money): string {
  return `${money.currency.code} ${money.toNumber()}`;
}
