import { Money, findCurrency } from "@lib/money";
import { ValidationError } from "$services/shared/kernel/errors/service-error";

export function assertPositiveInt(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
}

export function assertOptionalPositiveInt(value: number | undefined, field: string): void {
  if (value === undefined) return;
  assertPositiveInt(value, field);
}

export function assertMoney(price: Money, field = "price"): void {
  if (!(price instanceof Money) || !price.isPositive()) {
    throw new ValidationError(`${field} must be a positive Money amount`);
  }
}

export function assertItemCount(itemCount: number): void {
  if (typeof itemCount !== "number" || !Number.isInteger(itemCount) || itemCount <= 0) {
    throw new ValidationError("itemCount must be a positive integer");
  }
}

/**
 * Membangun nilai uang dari nominal (major unit) + kode mata uang.
 *
 * @throws {ValidationError} Kalau kodenya bukan mata uang yang dikenal.
 */
export function resolveMoney(amount: number, currencyCode: string): Money {
  const currency = findCurrency(currencyCode.toUpperCase());
  if (!currency) {
    throw new ValidationError(`Unknown currency: ${currencyCode}`);
  }
  return Money.fromNumber(amount, currency);
}

export function assertNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
}
