import {
  DECIMAL_MAX_COEFFICIENT,
  DECIMAL_MAX_SCALE,
  Decimal,
  DecimalError,
  divEuclid,
  remEuclid,
} from "./decimal";
import { isCurrencyMismatch, type Currency } from "./currency";
import { MoneyError } from "./error";
import { localFormatFromLocale } from "./locale";
import { Round, roundingStrategyFor } from "./round";
import { Formatter, defaultParamsFor, type FormatParams } from "./format";
import type { Exchange } from "./exchange";

const POW10: readonly bigint[] = Array.from({ length: 64 }, (_, index) => 10n ** BigInt(index));

function toDecimal(value: Decimal | number | bigint): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return Decimal.fromBigInt(value);
  return Decimal.fromNumber(value);
}

/**
 * An amount of a given currency.
 *
 * Ported from `rusty_money::Money`.
 *
 * The amount is stored as a {@link Decimal}, so the stored precision is
 * independent of the currency's exponent. Arithmetic and {@link Money.round}
 * return new values without changing the original. Rendering rounds to the
 * currency's exponent using {@link Round.HalfEven} without changing the stored
 * amount.
 */
export class Money {
  readonly #amount: Decimal;
  readonly #currency: Currency;

  private constructor(amount: Decimal, currency: Currency) {
    this.#amount = amount;
    this.#currency = currency;
  }

  /**
   * Creates a money object from an amount string and a currency.
   *
   * Supports fuzzy amount strings like `"100"`, `"100.00"` and `"-100.00"`, as
   * well as the grouped forms of the currency's locale (`"1,000.00"` for
   * `EnUs`, `"1 000,00"` for `EnBy`).
   *
   * @throws {MoneyError} `InvalidAmount` when the string cannot be parsed.
   */
  static fromString(amount: string, currency: Currency): Money {
    if (amount.length === 0) throw new MoneyError("InvalidAmount");

    const format = localFormatFromLocale(currency.locale);
    const parts = amount.split(format.exponentSeparator);
    if (parts.length > 2) throw new MoneyError("InvalidAmount");

    const integer = parts[0] ?? "";
    const fraction = parts[1];

    if (fraction !== undefined && (fraction.length === 0 || !/^[0-9]+$/.test(fraction))) {
      throw new MoneyError("InvalidAmount");
    }

    const grouped = integer.includes(format.digitSeparator);
    if (grouped) {
      const groups = integer.split(format.digitSeparator).reverse();
      let index = 0;
      for (const size of format.digitSeparatorPattern) {
        const group = groups[index];
        if (group === undefined) break;
        index += 1;
        // Only the groups to the right of the last separator are validated.
        if (index >= groups.length) break;
        if (group.length !== size) throw new MoneyError("InvalidAmount");
      }
    }

    // A decimal point and ungrouped digits already match the decimal format.
    let decimalInput: string;
    if (fraction !== undefined && !grouped && format.exponentSeparator === ".") {
      decimalInput = amount;
    } else {
      let buffer = grouped ? integer.split(format.digitSeparator).join("") : integer;
      buffer += ".";
      if (fraction !== undefined) {
        buffer += fraction;
      } else {
        // Preserve the scale of integer input, including trailing zeroes.
        buffer += "0".repeat(currency.exponent);
      }
      decimalInput = buffer;
    }

    const decimal = Decimal.fromString(decimalInput);
    if (!decimal) throw new MoneyError("InvalidAmount");

    return new Money(decimal, currency);
  }

  /** Alias of {@link Money.fromString}. */
  static fromStr(amount: string, currency: Currency): Money {
    return Money.fromString(amount, currency);
  }

  /**
   * Creates a money object from integral minor units.
   *
   * The amount represents minor units of the currency (e.g. `1000` becomes
   * `10.00` in USD, `1_000_000_000_000_000_000` becomes `1` in ETH).
   *
   * @throws {MoneyError} `InvalidAmount` when the currency exponent exceeds 28,
   * `Overflow` when the amount does not fit into the decimal range.
   */
  static fromMinor(amount: bigint | number, currency: Currency): Money {
    if (currency.exponent > DECIMAL_MAX_SCALE) throw new MoneyError("InvalidAmount");

    const value = typeof amount === "bigint" ? amount : BigInt(Math.trunc(amount));
    try {
      return new Money(new Decimal(value, currency.exponent), currency);
    } catch (error) {
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  /** Alias of {@link Money.fromMinor}. */
  static tryFromMinor(amount: bigint | number, currency: Currency): Money {
    return Money.fromMinor(amount, currency);
  }

  /**
   * Creates a money object from integral major units.
   *
   * The amount represents major units of the currency (e.g. `1000` becomes
   * `1,000` in USD).
   */
  static fromMajor(amount: bigint | number, currency: Currency): Money {
    const value = typeof amount === "bigint" ? amount : BigInt(Math.trunc(amount));
    try {
      return new Money(new Decimal(value, 0), currency);
    } catch (error) {
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  /**
   * Creates a money object from a decimal amount and a currency.
   *
   * The amount is stored unchanged, including any fractional minor units.
   */
  static fromDecimal(amount: Decimal, currency: Currency): Money {
    return new Money(amount, currency);
  }

  /** Creates a zero amount in the given currency. */
  static zero(currency: Currency): Money {
    return new Money(Decimal.ZERO, currency);
  }

  /** The decimal amount. */
  get amount(): Decimal {
    return this.#amount;
  }

  /** The currency of the amount. */
  get currency(): Currency {
    return this.#currency;
  }

  /** Whether the amount is zero. */
  isZero(): boolean {
    return this.#amount.isZero();
  }

  /** Whether the amount is greater than zero. */
  isPositive(): boolean {
    return this.#amount.isPositive();
  }

  /** Whether the amount is less than zero. */
  isNegative(): boolean {
    return this.#amount.isNegative();
  }

  /** Returns a new money object with the absolute value of the amount. */
  abs(): Money {
    return new Money(this.#amount.abs(), this.#currency);
  }

  /** Returns a new money object with the sign of the amount inverted. */
  negate(): Money {
    return new Money(this.#amount.negate(), this.#currency);
  }

  /**
   * Returns the amount in minor units (e.g. cents for USD, satoshis for BTC).
   *
   * Fractional minor units are truncated toward zero. Use
   * {@link Money.tryToMinorUnits} for an exact, checked conversion.
   */
  toMinorUnits(): bigint {
    const truncated = this.#amount.roundDp(this.#currency.exponent, "ToZero");
    return scaledMinorUnits(truncated, this.#currency.exponent);
  }

  /**
   * Returns the exact amount in minor units, without rounding or truncation.
   *
   * Trailing fractional zeroes do not count as excess precision. Round
   * explicitly before converting when a rounding policy is wanted.
   *
   * @throws {MoneyError} `PrecisionLoss` when the amount has a fractional minor
   * unit.
   */
  tryToMinorUnits(): bigint {
    const coefficient = this.#amount.coefficient;
    if (coefficient === 0n) return 0n;

    const scale = this.#amount.scale;
    const exponent = this.#currency.exponent;

    if (scale > exponent) {
      const divisor = POW10[scale - exponent] ?? 10n ** BigInt(scale - exponent);
      if (coefficient % divisor !== 0n) throw new MoneyError("PrecisionLoss");
      return coefficient / divisor;
    }

    return coefficient * (POW10[exponent - scale] ?? 10n ** BigInt(exponent - scale));
  }

  /** Returns the amount as a JavaScript number. The conversion is lossy. */
  toNumber(): number {
    return this.#amount.toNumber();
  }

  /**
   * Adds two money objects.
   *
   * @throws {MoneyError} `CurrencyMismatch` when the currencies differ,
   * `Overflow` when the addition overflows.
   */
  add(other: Money): Money {
    this.#assertSameCurrency(other);
    try {
      return new Money(this.#amount.add(other.#amount), this.#currency);
    } catch (error) {
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  /**
   * Subtracts two money objects.
   *
   * @throws {MoneyError} `CurrencyMismatch` when the currencies differ,
   * `Overflow` when the subtraction overflows.
   */
  subtract(other: Money): Money {
    this.#assertSameCurrency(other);
    try {
      return new Money(this.#amount.subtract(other.#amount), this.#currency);
    } catch (error) {
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  /** Alias of {@link Money.subtract}. */
  sub(other: Money): Money {
    return this.subtract(other);
  }

  /**
   * Multiplies a money object by a scalar.
   *
   * @throws {MoneyError} `Overflow` when the multiplication overflows.
   */
  multiply(factor: Decimal | number | bigint): Money {
    const scalar = toDecimal(factor);
    try {
      return new Money(this.#amount.multiply(scalar), this.#currency);
    } catch (error) {
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  /** Alias of {@link Money.multiply}. */
  mul(factor: Decimal | number | bigint): Money {
    return this.multiply(factor);
  }

  /**
   * Divides a money object by a scalar.
   *
   * @throws {MoneyError} `DivisionByZero` when the divisor is zero,
   * `Overflow` when the division overflows.
   */
  divide(divisor: Decimal | number | bigint): Money {
    const scalar = toDecimal(divisor);
    if (scalar.isZero()) throw new MoneyError("DivisionByZero");

    try {
      return new Money(this.#amount.divide(scalar), this.#currency);
    } catch (error) {
      if (error instanceof DecimalError && error.reason === "DivisionByZero") {
        throw new MoneyError("DivisionByZero", { cause: error });
      }
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  /** Alias of {@link Money.divide}. */
  div(divisor: Decimal | number | bigint): Money {
    return this.divide(divisor);
  }

  /**
   * Converts this money object to another currency using the given exchange rates.
   *
   * @throws {MoneyError} `InvalidCurrency` when no exchange rate exists for the
   * currency pair, `Overflow` when the conversion overflows.
   */
  exchangeTo(target: Currency, exchange: Exchange): Money {
    const rate = exchange.getRate(this.#currency, target);
    if (!rate) throw new MoneyError("InvalidCurrency");
    return rate.convert(this);
  }

  /**
   * Compares two money objects.
   *
   * @throws {MoneyError} `CurrencyMismatch` when the currencies differ.
   */
  compare(other: Money): -1 | 0 | 1 {
    this.#assertSameCurrency(other);
    return this.#amount.compare(other.#amount);
  }

  /** Whether this amount is greater than `other`. */
  gt(other: Money): boolean {
    return this.compare(other) > 0;
  }

  /** Whether this amount is greater than or equal to `other`. */
  gte(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  /** Whether this amount is less than `other`. */
  lt(other: Money): boolean {
    return this.compare(other) < 0;
  }

  /** Whether this amount is less than or equal to `other`. */
  lte(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  /**
   * Whether this amount equals `other`.
   *
   * @throws {MoneyError} `CurrencyMismatch` when the currencies differ.
   */
  equals(other: Money): boolean {
    return this.compare(other) === 0;
  }

  /** Alias of {@link Money.equals}. */
  eq(other: Money): boolean {
    return this.equals(other);
  }

  /**
   * Divides the money equally into `n` shares.
   *
   * The amount is floored to integral minor units, then every equal share is
   * floored. Remaining minor units are given to the first shares in order.
   * Flooring also applies to negative values: USD `-1.005` is split as
   * `-1.01`, not `-1.00`.
   *
   * @throws {MoneyError} `InvalidRatio` when `n` is zero, `Overflow` when a
   * share cannot be represented exactly.
   */
  split(n: number): Money[] {
    if (!Number.isInteger(n) || n <= 0) throw new MoneyError("InvalidRatio");

    const totalMinor = this.#allocationMinorUnits();
    const shares = BigInt(n);
    const baseShare = divEuclid(totalMinor, shares);
    const remainderCount = Number(remEuclid(totalMinor, shares));

    const lowShare = this.#allocationShare(baseShare);
    const highShare = remainderCount === 0 ? lowShare : this.#allocationShare(baseShare + 1n);

    const result: Money[] = [];
    for (let index = 0; index < n; index += 1) {
      result.push(index < remainderCount ? highShare : lowShare);
    }
    return result;
  }

  /**
   * Divides the money into shares according to the given weights.
   *
   * The amount is floored to integral minor units, then every weighted share is
   * floored towards negative infinity. If the division cannot be applied
   * perfectly, the remainder is given to the shares with a non-zero weight in
   * input order.
   *
   * @throws {MoneyError} `InvalidRatio` for empty or all-zero weights,
   * `Overflow` when a share cannot be represented exactly.
   */
  allocate(weights: readonly number[]): Money[] {
    if (weights.length === 0) throw new MoneyError("InvalidRatio");

    let shareTotal = 0n;
    for (const weight of weights) {
      if (!Number.isInteger(weight) || weight < 0) throw new MoneyError("InvalidRatio");
      shareTotal += BigInt(weight);
    }
    if (shareTotal === 0n) throw new MoneyError("InvalidRatio");

    const totalMinor = this.#allocationMinorUnits();
    const denominator = shareTotal;
    const quotient = divEuclid(totalMinor, denominator);
    const residual = remEuclid(totalMinor, denominator);

    const allocations: bigint[] = [];
    let allocated = 0n;
    for (const weight of weights) {
      const value = BigInt(weight);
      // floor(total * weight / sum), without multiplying the full total by the weight.
      const shareValue = quotient * value + (residual * value) / denominator;
      allocations.push(shareValue);
      allocated += shareValue;
    }

    let remainder = totalMinor - allocated;
    for (let index = 0; index < allocations.length && remainder !== 0n; index += 1) {
      if (weights[index]! > 0) {
        allocations[index] = allocations[index]! + 1n;
        remainder -= 1n;
      }
    }

    return allocations.map((minor) => this.#allocationShare(minor));
  }

  /**
   * Returns a new money object rounded to `digits` decimal places.
   *
   * The original amount is unchanged. Use the currency's exponent to round to
   * minor units.
   */
  round(digits: number, strategy: Round): Money {
    return new Money(this.#amount.roundDp(digits, roundingStrategyFor(strategy)), this.#currency);
  }

  /**
   * Formats the amount using the currency's locale, symbol and exponent.
   *
   * The provided parameters override the defaults derived from the currency.
   */
  format(params: Partial<FormatParams> = {}): string {
    return Formatter.money(this, { ...defaultParamsFor(this.#currency), ...params });
  }

  /** Serializes the amount and currency, mirroring the serde implementation. */
  toJSON(): { amount: string; currency: string } {
    return { amount: this.#amount.toString(), currency: this.#currency.code };
  }

  /** Renders the amount using the currency's locale and symbol. */
  toString(): string {
    return Formatter.money(this, defaultParamsFor(this.#currency));
  }

  /** Floors the amount to integral minor units. */
  #allocationMinorUnits(): bigint {
    const exponent = this.#currency.exponent;
    if (exponent > DECIMAL_MAX_SCALE) throw new MoneyError("Overflow");

    const coefficient = this.#amount.coefficient;
    const scale = this.#amount.scale;

    if (scale > exponent) {
      const divisor = POW10[scale - exponent] ?? 10n ** BigInt(scale - exponent);
      return divEuclid(coefficient, divisor);
    }

    return coefficient * (POW10[exponent - scale] ?? 10n ** BigInt(exponent - scale));
  }

  /**
   * Builds a share from integral minor units.
   *
   * Only redundant zeroes are removed when needed to fit into the decimal
   * range; a share is never rounded, which would break the conservation of the
   * total.
   */
  #allocationShare(minor: bigint): Money {
    let value = minor;
    let scale = this.#currency.exponent;

    while (absBigInt(value) > DECIMAL_MAX_COEFFICIENT && scale > 0 && value % 10n === 0n) {
      value /= 10n;
      scale -= 1;
    }

    try {
      return new Money(new Decimal(value, scale), this.#currency);
    } catch (error) {
      throw new MoneyError("Overflow", { cause: error });
    }
  }

  #assertSameCurrency(other: Money): void {
    if (isCurrencyMismatch(this.#currency, other.#currency)) {
      throw new MoneyError("CurrencyMismatch", {
        expected: this.#currency.code,
        actual: other.#currency.code,
      });
    }
  }
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function scaledMinorUnits(amount: Decimal, exponent: number): bigint {
  const coefficient = amount.coefficient;
  const scale = amount.scale;

  if (scale > exponent) {
    const divisor = POW10[scale - exponent] ?? 10n ** BigInt(scale - exponent);
    return coefficient / divisor;
  }

  return coefficient * (POW10[exponent - scale] ?? 10n ** BigInt(exponent - scale));
}
