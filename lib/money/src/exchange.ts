import { currenciesEqual, isCurrencyMismatch, type Currency } from "./currency";
import { DecimalError, type Decimal } from "./decimal";
import { MoneyError } from "./error";
import { Money } from "./money";

/**
 * A rate of conversion between two currencies.
 *
 * Ported from `rusty_money::ExchangeRate`.
 */
export class ExchangeRate {
  /** The source currency. */
  readonly from: Currency;
  /** The target currency. */
  readonly to: Currency;
  /** The conversion rate. */
  readonly rate: Decimal;

  /**
   * Creates an exchange rate.
   *
   * @throws {MoneyError} `InvalidCurrency` when source and target are the same
   * currency.
   */
  constructor(from: Currency, to: Currency, rate: Decimal) {
    if (currenciesEqual(from, to)) throw new MoneyError("InvalidCurrency");
    this.from = from;
    this.to = to;
    this.rate = rate;
  }

  /**
   * Converts a money object from the source currency to the target currency.
   *
   * @throws {MoneyError} `InvalidCurrency` when the amount's currency does not
   * match the source, `Overflow` when the conversion overflows.
   */
  convert(amount: Money): Money {
    if (isCurrencyMismatch(amount.currency, this.from)) {
      throw new MoneyError("InvalidCurrency", {
        expected: this.from.code,
        actual: amount.currency.code,
      });
    }

    try {
      return Money.fromDecimal(amount.amount.multiply(this.rate), this.to);
    } catch (error) {
      if (error instanceof DecimalError) {
        throw new MoneyError("Overflow", { cause: error });
      }
      throw error;
    }
  }
}

/**
 * Stores exchange rates for easier access.
 *
 * Ported from `rusty_money::Exchange`.
 */
export class Exchange {
  readonly #rates = new Map<string, ExchangeRate>();

  /** Creates an empty exchange. */
  constructor(rates: readonly ExchangeRate[] = []) {
    for (const rate of rates) this.setRate(rate);
  }

  /** Updates an exchange rate or adds it if it does not exist. */
  setRate(rate: ExchangeRate): void {
    this.#rates.set(Exchange.generateKey(rate.from, rate.to), rate);
  }

  /** Returns the exchange rate for the currency pair. */
  getRate(from: Currency, to: Currency): ExchangeRate | undefined {
    return this.#rates.get(Exchange.generateKey(from, to));
  }

  /** Removes the exchange rate for the currency pair. */
  removeRate(from: Currency, to: Currency): boolean {
    return this.#rates.delete(Exchange.generateKey(from, to));
  }

  /** Whether an exchange rate exists for the currency pair. */
  hasRate(from: Currency, to: Currency): boolean {
    return this.#rates.has(Exchange.generateKey(from, to));
  }

  static generateKey(from: Currency, to: Currency): string {
    return `${from.code}->${to.code}`;
  }
}
