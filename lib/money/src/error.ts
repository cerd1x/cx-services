/**
 * Error type for the money library.
 *
 * Ported from `rusty_money::MoneyError`. The Rust enum variants become a
 * discriminant (`kind`) plus the payload fields that the variant carried.
 */

export type MoneyErrorKind =
  | "InvalidCurrency"
  | "InvalidAmount"
  | "InvalidRatio"
  | "CurrencyMismatch"
  | "DivisionByZero"
  | "Overflow"
  | "PrecisionLoss";

export interface MoneyErrorOptions {
  /** Currency code that was expected. */
  expected?: string;
  /** Currency code that was received. */
  actual?: string;
  /** Underlying error, if any. */
  cause?: unknown;
}

const MESSAGES: Record<MoneyErrorKind, string> = {
  InvalidCurrency: "Currency was not valid",
  InvalidAmount: "Amount not parsable",
  InvalidRatio: "Ratio was not valid",
  CurrencyMismatch: "Currency mismatch",
  DivisionByZero: "Division by zero",
  Overflow: "Arithmetic overflow",
  PrecisionLoss: "Conversion would lose precision",
};

/** Standard error type for this library. */
export class MoneyError extends Error {
  readonly kind: MoneyErrorKind;
  /** Currency code that was expected, set for `CurrencyMismatch`. */
  readonly expected?: string;
  /** Currency code that was received, set for `CurrencyMismatch`. */
  readonly actual?: string;

  constructor(kind: MoneyErrorKind, options: MoneyErrorOptions = {}) {
    const message =
      kind === "CurrencyMismatch" && options.expected !== undefined && options.actual !== undefined
        ? `Currency mismatch: expected ${options.expected}, got ${options.actual}`
        : MESSAGES[kind];

    super(message, { cause: options.cause });
    this.name = "MoneyError";
    this.kind = kind;
    this.expected = options.expected;
    this.actual = options.actual;
  }
}

/** Type guard for {@link MoneyError}. */
export function isMoneyError(value: unknown): value is MoneyError {
  return value instanceof MoneyError;
}
