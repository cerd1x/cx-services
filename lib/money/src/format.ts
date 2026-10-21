import { DECIMAL_MAX_SCALE, type Decimal } from "./decimal";
import type { Currency } from "./currency";
import { localFormatFromLocale } from "./locale";
import { Round } from "./round";
import type { Money } from "./money";

/**
 * Items which must be positioned in a money string.
 *
 * Ported from `rusty_money::format::Position`.
 */
export const Position = {
  Space: "Space",
  Amount: "Amount",
  Code: "Code",
  Symbol: "Symbol",
  Sign: "Sign",
} as const;

export type Position = (typeof Position)[keyof typeof Position];

/** Group of formatting parameters consumed by the {@link Formatter}. */
export interface FormatParams {
  /** The character that separates grouped digits (e.g. `1,000,000`). */
  readonly digitSeparator: string;
  /** The character that separates minor units from major units (e.g. `1,000.00`). */
  readonly exponentSeparator: string;
  /** The grouping pattern applied to the digits, counted from right to left. */
  readonly separatorPattern: readonly number[];
  /** The relative positions of the elements in the output (e.g. `-$1,000`). */
  readonly positions: readonly Position[];
  /** The number of minor unit digits that remain after rounding. */
  readonly rounding: number | null;
  /** The symbol of the currency (e.g. `$`). */
  readonly symbol: string | null;
  /** The currency code (e.g. `USD`). */
  readonly code: string | null;
}

/** Default formatting parameters, mirroring `rusty_money::format::Params::default`. */
export const DEFAULT_FORMAT_PARAMS: FormatParams = {
  digitSeparator: ",",
  exponentSeparator: ".",
  separatorPattern: [3, 3, 3],
  positions: [Position.Sign, Position.Symbol, Position.Amount],
  rounding: null,
  symbol: null,
  code: null,
};

/**
 * Converts money objects into human readable strings.
 *
 * Ported from `rusty_money::format::Formatter`.
 */
export const Formatter = {
  /** Returns a formatted string for a money object. */
  money(money: Money, params: FormatParams): string {
    let decimal: Decimal = money.amount;

    // Round the decimal and ensure it has the correct scale.
    if (params.rounding !== null && params.rounding !== undefined) {
      const digits = Math.min(params.rounding, DECIMAL_MAX_SCALE);
      decimal = money.round(digits, Round.HalfEven).amount;
      decimal = decimal.rescale(digits);
    }

    const rawAmount = unsignedDecimalText(decimal);
    const separatorIndex = rawAmount.indexOf(".");
    const digits = separatorIndex === -1 ? rawAmount : rawAmount.slice(0, separatorIndex);
    const fraction = separatorIndex === -1 ? undefined : rawAmount.slice(separatorIndex + 1);

    let output = "";
    for (const position of params.positions) {
      switch (position) {
        case Position.Space:
          output += " ";
          break;
        case Position.Amount:
          output += writeDigits(digits, params);
          if (fraction !== undefined) {
            output += params.exponentSeparator;
            output += fraction;
          }
          break;
        case Position.Code:
          output += params.code ?? "";
          break;
        case Position.Symbol:
          output += params.symbol ?? "";
          break;
        case Position.Sign:
          if (money.isNegative()) output += "-";
          break;
      }
    }

    return output;
  },
};

/** Writes the digits of an amount, applying the grouping pattern. */
function writeDigits(digits: string, params: FormatParams): string {
  let grouped = 0;
  let count = 0;

  for (const width of params.separatorPattern) {
    if (width >= digits.length - grouped) break;
    grouped += width;
    count += 1;
  }

  let start = digits.length - grouped;
  let output = digits.slice(0, start);

  for (let index = count - 1; index >= 0; index -= 1) {
    const width = params.separatorPattern[index] ?? 0;
    output += params.digitSeparator;
    output += digits.slice(start, start + width);
    start += width;
  }

  return output;
}

/** Renders the absolute value of a decimal, keeping the scale. */
function unsignedDecimalText(decimal: Decimal): string {
  const coefficient = decimal.coefficient < 0n ? -decimal.coefficient : decimal.coefficient;
  const digits = coefficient.toString();
  const scale = decimal.scale;

  if (scale === 0) return digits;

  if (digits.length > scale) {
    const boundary = digits.length - scale;
    return `${digits.slice(0, boundary)}.${digits.slice(boundary)}`;
  }

  return `0.${"0".repeat(scale - digits.length)}${digits}`;
}

/**
 * Builds the formatting parameters used by {@link Money.toString}.
 *
 * The symbol is placed before the amount when the currency asks for it,
 * otherwise it trails the amount.
 */
export function defaultParamsFor(currency: Currency): FormatParams {
  const format = localFormatFromLocale(currency.locale);

  return {
    digitSeparator: format.digitSeparator,
    exponentSeparator: format.exponentSeparator,
    separatorPattern: format.digitSeparatorPattern,
    positions: currency.symbolFirst
      ? [Position.Sign, Position.Symbol, Position.Amount]
      : [Position.Sign, Position.Amount, Position.Symbol],
    rounding: currency.exponent,
    symbol: currency.symbol,
    code: currency.code,
  };
}
