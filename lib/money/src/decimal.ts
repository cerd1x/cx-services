/**
 * Fixed-point decimal arithmetic.
 *
 * Ported from the `rust_decimal` crate (v1.39) that `rusty-money` builds on.
 * A value is stored as a 96-bit signed coefficient plus a scale in `0..=28`,
 * so `1.50` keeps its trailing zero exactly like `rust_decimal` does.
 *
 * Everything is computed with `bigint`, so no intermediate value is ever
 * rounded through a binary float.
 */

/** Maximum number of fractional digits a decimal can hold. */
export const DECIMAL_MAX_SCALE = 28;

/** Largest magnitude a decimal coefficient can hold (2^96 - 1). */
export const DECIMAL_MAX_COEFFICIENT = 79228162514264337593543950335n;

const POW10: readonly bigint[] = Array.from({ length: 64 }, (_, index) => 10n ** BigInt(index));

/** Rounding modes, mirroring `rust_decimal::RoundingStrategy`. */
export type RoundingStrategy =
  | "MidpointNearestEven"
  | "MidpointAwayFromZero"
  | "MidpointTowardZero"
  | "ToZero"
  | "AwayFromZero"
  | "ToNegativeInfinity"
  | "ToPositiveInfinity";

/** Raised when a decimal operation cannot be represented. */
export class DecimalError extends Error {
  readonly reason: "Overflow" | "DivisionByZero";

  constructor(reason: "Overflow" | "DivisionByZero", message: string) {
    super(message);
    this.name = "DecimalError";
    this.reason = reason;
  }
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function withinCoefficient(value: bigint): boolean {
  return value <= DECIMAL_MAX_COEFFICIENT && value >= -DECIMAL_MAX_COEFFICIENT;
}

function decimalDigits(value: bigint): number {
  return value.toString().length;
}

/** Divides by `10 ** power` using the requested midpoint behaviour. */
function divPow10(coefficient: bigint, power: number, strategy: RoundingStrategy): bigint {
  if (power <= 0) return coefficient;

  const divisor = POW10[power] ?? 10n ** BigInt(power);
  const negative = coefficient < 0n;
  const magnitude = negative ? -coefficient : coefficient;
  const quotient = magnitude / divisor;
  const remainder = magnitude % divisor;

  let rounded = quotient;
  if (remainder !== 0n) {
    const twice = remainder * 2n;
    switch (strategy) {
      case "MidpointNearestEven":
        rounded =
          twice > divisor
            ? quotient + 1n
            : twice < divisor
              ? quotient
              : quotient % 2n === 0n
                ? quotient
                : quotient + 1n;
        break;
      case "MidpointAwayFromZero":
        rounded = twice >= divisor ? quotient + 1n : quotient;
        break;
      case "MidpointTowardZero":
        rounded = twice > divisor ? quotient + 1n : quotient;
        break;
      case "ToZero":
        rounded = quotient;
        break;
      case "AwayFromZero":
        rounded = quotient + 1n;
        break;
      case "ToNegativeInfinity":
        rounded = negative ? quotient + 1n : quotient;
        break;
      case "ToPositiveInfinity":
        rounded = negative ? quotient : quotient + 1n;
        break;
    }
  }

  return negative ? -rounded : rounded;
}

/** Floor division, matching Rust's `i128::div_euclid`. */
export function divEuclid(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  if (remainder !== 0n && remainder < 0n !== divisor < 0n) return quotient - 1n;
  return quotient;
}

/** Remainder with the sign of the divisor, matching Rust's `i128::rem_euclid`. */
export function remEuclid(dividend: bigint, divisor: bigint): bigint {
  const remainder = dividend % divisor;
  if (remainder !== 0n && remainder < 0n !== divisor < 0n) return remainder + divisor;
  return remainder;
}

/**
 * An arbitrary-precision fixed-point decimal.
 *
 * The value is `coefficient / 10 ** scale`.
 */
export class Decimal {
  static readonly ZERO = new Decimal(0n, 0);
  static readonly ONE = new Decimal(1n, 0);
  static readonly MAX = new Decimal(DECIMAL_MAX_COEFFICIENT, 0);
  static readonly MIN = new Decimal(-DECIMAL_MAX_COEFFICIENT, 0);

  readonly #coefficient: bigint;
  readonly #scale: number;

  constructor(coefficient: bigint, scale = 0) {
    if (scale < 0 || scale > DECIMAL_MAX_SCALE) {
      throw new DecimalError(
        "Overflow",
        `Decimal scale must be between 0 and ${DECIMAL_MAX_SCALE}`,
      );
    }
    if (!withinCoefficient(coefficient)) {
      throw new DecimalError("Overflow", "Decimal coefficient exceeds 96 bits");
    }
    this.#coefficient = coefficient;
    this.#scale = scale;
  }

  /** The signed coefficient of the decimal. */
  get coefficient(): bigint {
    return this.#coefficient;
  }

  /** The number of fractional digits. */
  get scale(): number {
    return this.#scale;
  }

  /** Builds a decimal from a coefficient and a scale. */
  static fromParts(coefficient: bigint, scale = 0): Decimal {
    return new Decimal(coefficient, scale);
  }

  /** Builds a decimal from an integer value. */
  static fromBigInt(value: bigint): Decimal {
    return new Decimal(value, 0);
  }

  /**
   * Builds a decimal from a JavaScript number.
   *
   * The number is converted through its shortest decimal representation, so
   * `0.1` becomes exactly `0.1` instead of the binary approximation. Numbers
   * that JavaScript renders in the scientific notation (`1e-7`, `1e+21`) are
   * expanded into a plain decimal literal first.
   */
  static fromNumber(value: number): Decimal {
    if (!Number.isFinite(value)) {
      throw new DecimalError("Overflow", "Cannot build a decimal from a non-finite number");
    }
    const text = value.toString();
    const direct = Decimal.fromString(text);
    if (direct) return direct;

    const expanded = expandScientific(text);
    if (expanded) {
      const parsed = Decimal.fromString(expanded);
      if (parsed) return parsed;
    }

    throw new DecimalError("Overflow", `Cannot build a decimal from ${value}`);
  }

  /**
   * Parses a decimal literal.
   *
   * Accepts an optional sign, a single decimal point and `_` digit separators,
   * matching `rust_decimal`'s parser. Returns `null` when the text is not a
   * valid decimal.
   */
  static fromString(text: string): Decimal | null {
    if (text.length === 0) return null;

    let index = 0;
    let negative = false;
    if (text[0] === "-") {
      negative = true;
      index = 1;
    } else if (text[0] === "+") {
      index = 1;
    }

    let digits = "";
    let integerDigits = 0;
    let seenPoint = false;
    let seenDigit = false;

    for (; index < text.length; index += 1) {
      const char = text[index]!;
      if (char >= "0" && char <= "9") {
        digits += char;
        if (!seenPoint) integerDigits += 1;
        seenDigit = true;
        continue;
      }
      if (char === ".") {
        if (seenPoint) return null;
        seenPoint = true;
        continue;
      }
      if (char === "_") {
        // Separators are only allowed once a digit has been seen.
        if (!seenDigit) return null;
        continue;
      }
      return null;
    }

    if (!seenDigit) return null;

    let coefficient = 0n;
    let scale = 0;
    for (let position = 0; position < digits.length; position += 1) {
      const digit = BigInt(digits.charCodeAt(position) - 48);
      const fractional = position >= integerDigits;
      const next = coefficient * 10n + digit;

      if (!withinCoefficient(next)) {
        if (!fractional) return null;
        const rounded = roundAtDroppedDigit(coefficient, digit, scale);
        if (!rounded) return null;
        coefficient = rounded.coefficient;
        scale = rounded.scale;
        break;
      }

      coefficient = next;
      if (!fractional) continue;

      scale += 1;
      if (scale === DECIMAL_MAX_SCALE && position + 1 < digits.length) {
        const following = BigInt(digits.charCodeAt(position + 1) - 48);
        const rounded = roundAtDroppedDigit(coefficient, following, scale);
        if (!rounded) return null;
        coefficient = rounded.coefficient;
        scale = rounded.scale;
        break;
      }
    }

    return new Decimal(negative ? -coefficient : coefficient, scale);
  }

  isZero(): boolean {
    return this.#coefficient === 0n;
  }

  isPositive(): boolean {
    return this.#coefficient > 0n;
  }

  isNegative(): boolean {
    return this.#coefficient < 0n;
  }

  /** Numeric equality; the scale is ignored, like `rust_decimal`. */
  equals(other: Decimal): boolean {
    return this.compare(other) === 0;
  }

  /** Numeric comparison; the scale is ignored, like `rust_decimal`. */
  compare(other: Decimal): -1 | 0 | 1 {
    const left = this.#coefficient * POW10[other.#scale];
    const right = other.#coefficient * POW10[this.#scale];
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  abs(): Decimal {
    return new Decimal(abs(this.#coefficient), this.#scale);
  }

  negate(): Decimal {
    return new Decimal(-this.#coefficient, this.#scale);
  }

  add(other: Decimal): Decimal {
    if (this.#coefficient === 0n) return other;
    if (other.#coefficient === 0n) return this;

    const scale = Math.max(this.#scale, other.#scale);
    const left = this.#coefficient * POW10[scale - this.#scale];
    const right = other.#coefficient * POW10[scale - other.#scale];
    return fit(left + right, scale);
  }

  subtract(other: Decimal): Decimal {
    if (this.#coefficient === 0n) return other.negate();
    if (other.#coefficient === 0n) return this;

    const scale = Math.max(this.#scale, other.#scale);
    const left = this.#coefficient * POW10[scale - this.#scale];
    const right = other.#coefficient * POW10[scale - other.#scale];
    return fit(left - right, scale);
  }

  multiply(other: Decimal): Decimal {
    if (this.#coefficient === 0n || other.#coefficient === 0n) return Decimal.ZERO;
    return fit(this.#coefficient * other.#coefficient, this.#scale + other.#scale);
  }

  divide(other: Decimal): Decimal {
    if (other.#coefficient === 0n) {
      throw new DecimalError("DivisionByZero", "Division by zero");
    }
    if (this.#coefficient === 0n) return Decimal.ZERO;

    const negative = this.#coefficient < 0n !== other.#coefficient < 0n;
    const dividend = abs(this.#coefficient);
    const divisor = abs(other.#coefficient);

    let scale = this.#scale - other.#scale;
    let quotient: bigint;
    let remainder: bigint;
    if (scale >= 0) {
      quotient = dividend / divisor;
      remainder = dividend % divisor;
    } else {
      const multiplier = POW10[-scale] ?? 10n ** BigInt(-scale);
      quotient = (dividend * multiplier) / divisor;
      remainder = (dividend * multiplier) % divisor;
      scale = 0;
    }

    let remainderSeen = false;
    while (remainder !== 0n && scale < DECIMAL_MAX_SCALE) {
      remainderSeen = true;
      const step = Math.min(9, DECIMAL_MAX_SCALE - scale);
      const multiplier = POW10[step];
      const scaledQuotient = quotient * multiplier;
      const scaledRemainder = remainder * multiplier;
      quotient = scaledQuotient + scaledRemainder / divisor;
      remainder = scaledRemainder % divisor;
      scale += step;
      if (!withinCoefficient(quotient)) {
        throw new DecimalError("Overflow", "Decimal overflow");
      }
    }

    if (remainder !== 0n) {
      remainderSeen = true;
      const twice = remainder * 2n;
      if (twice > divisor || (twice === divisor && quotient % 2n !== 0n)) {
        quotient += 1n;
      }
    }

    if (remainderSeen) {
      while (scale > 0 && quotient % 10n === 0n) {
        quotient /= 10n;
        scale -= 1;
      }
    }

    const result = new Decimal(negative ? -quotient : quotient, scale);
    if (!withinCoefficient(result.coefficient)) {
      throw new DecimalError("Overflow", "Decimal overflow");
    }
    return result;
  }

  /**
   * Rounds the decimal to `digits` fractional digits.
   *
   * The original value is left untouched.
   */
  roundDp(digits: number, strategy: RoundingStrategy): Decimal {
    if (digits < 0 || digits > DECIMAL_MAX_SCALE) {
      throw new DecimalError(
        "Overflow",
        `Rounding digits must be between 0 and ${DECIMAL_MAX_SCALE}`,
      );
    }
    if (this.#scale <= digits) return this;
    if (this.#coefficient === 0n) return new Decimal(0n, digits);

    const dropped = this.#scale - digits;
    const divisor = POW10[dropped];
    const negative = this.#coefficient < 0n;
    const magnitude = abs(this.#coefficient);
    const truncated = magnitude / divisor;
    const remainder = magnitude % divisor;
    const twice = remainder * 2n;

    let value = truncated;
    switch (strategy) {
      case "MidpointNearestEven":
        if (twice > divisor || (twice === divisor && truncated % 2n !== 0n)) value += 1n;
        break;
      case "MidpointAwayFromZero":
        if (twice >= divisor) value += 1n;
        break;
      case "MidpointTowardZero":
        if (twice > divisor) value += 1n;
        break;
      case "ToZero":
        break;
      case "AwayFromZero":
        if (remainder !== 0n) value += 1n;
        break;
      case "ToNegativeInfinity":
        if (negative && remainder !== 0n) value += 1n;
        break;
      case "ToPositiveInfinity":
        if (!negative && remainder !== 0n) value += 1n;
        break;
    }

    return new Decimal(negative ? -value : value, digits);
  }

  /**
   * Rescales the decimal to `scale`.
   *
   * Scaling up pads the coefficient with zeros and stops early if the
   * coefficient would no longer fit into 96 bits, mirroring
   * `rust_decimal::Decimal::rescale`. Scaling down drops digits and rounds
   * half-up.
   */
  rescale(scale: number): Decimal {
    if (scale < 0 || scale > DECIMAL_MAX_SCALE) {
      throw new DecimalError(
        "Overflow",
        `Decimal scale must be between 0 and ${DECIMAL_MAX_SCALE}`,
      );
    }
    if (scale === this.#scale) return this;
    if (this.#coefficient === 0n) return new Decimal(0n, scale);

    if (scale > this.#scale) {
      let value = this.#coefficient;
      let currentScale = this.#scale;
      while (currentScale < scale) {
        const next = value * 10n;
        if (!withinCoefficient(next)) break;
        value = next;
        currentScale += 1;
      }
      return new Decimal(value, currentScale);
    }

    return this.roundDp(scale, "MidpointAwayFromZero");
  }

  /** The decimal rendered with its current scale. */
  toString(): string {
    const negative = this.#coefficient < 0n;
    let digits = abs(this.#coefficient).toString();
    if (this.#scale === 0) return `${negative ? "-" : ""}${digits}`;

    if (digits.length <= this.#scale) {
      digits = "0".repeat(this.#scale - digits.length + 1) + digits;
    }
    const whole = digits.slice(0, digits.length - this.#scale);
    const fraction = digits.slice(digits.length - this.#scale);
    return `${negative ? "-" : ""}${whole}.${fraction}`;
  }

  /** A lossy conversion to a JavaScript number. */
  toNumber(): number {
    return Number(this.toString());
  }

  /** Number of significant decimal digits of the coefficient. */
  get precision(): number {
    return decimalDigits(abs(this.#coefficient));
  }
}

/**
 * Expands a literal in the scientific notation into a plain decimal literal.
 *
 * `Number.prototype.toString` switches to the exponential form for values
 * below `1e-6` and above `1e21`, e.g. `1e-7` or `1e+21`.
 */
function expandScientific(text: string): string | null {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) return null;

  const sign = match[1]!;
  const integer = match[2]!;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]!);
  const digits = integer + fraction;
  const point = integer.length + exponent;

  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${"0".repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * Applies the "round half up at the first dropped digit" rule used while
 * parsing literals that do not fit into 96 bits.
 */
function roundAtDroppedDigit(
  coefficient: bigint,
  digit: bigint,
  scale: number,
): { coefficient: bigint; scale: number } | null {
  let value = coefficient;
  let currentScale = scale;

  if (digit >= 5n) {
    value = coefficient + 1n;
    if (!withinCoefficient(value)) {
      if (currentScale === 0) return null;
      value = (value + 4n) / 10n;
      currentScale -= 1;
    }
  }

  return { coefficient: value, scale: currentScale };
}

/**
 * Rounds a coefficient so that it fits into 96 bits and a scale of at most
 * {@link DECIMAL_MAX_SCALE}, keeping the value as close as possible.
 */
function fit(coefficient: bigint, scale: number): Decimal {
  let power = Math.max(0, scale - DECIMAL_MAX_SCALE);

  while (!withinCoefficient(divPow10(coefficient, power, "MidpointNearestEven"))) {
    power += 1;
    if (power > scale) {
      throw new DecimalError("Overflow", "Decimal overflow");
    }
  }

  const value = divPow10(coefficient, power, "MidpointNearestEven");
  const fittedScale = scale - power;
  if (fittedScale < 0) {
    throw new DecimalError("Overflow", "Decimal overflow");
  }
  return new Decimal(value, fittedScale);
}
