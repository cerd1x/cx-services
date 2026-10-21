import { describe, expect, it } from "bun:test";
import { Decimal, Exchange, ExchangeRate, Money, MoneyError, crypto, iso } from "@lib/money";

describe("ExchangeRate", () => {
  it("rejects identical currencies", () => {
    expect(() => new ExchangeRate(iso.GBP, iso.GBP, Decimal.fromString("1.5")!)).toThrow(
      MoneyError,
    );

    try {
      new ExchangeRate(iso.GBP, iso.GBP, Decimal.fromString("1.5")!);
    } catch (error) {
      expect((error as MoneyError).kind).toBe("InvalidCurrency");
    }
  });

  it("converts an amount", () => {
    const rate = new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("1.5")!);
    const amount = Money.fromMinor(1000, iso.USD);

    expect(rate.convert(amount).equals(Money.fromMinor(1500, iso.EUR))).toBe(true);
  });

  it("rejects amounts from another currency", () => {
    const rate = new ExchangeRate(iso.GBP, iso.EUR, Decimal.fromString("1.5")!);
    const amount = Money.fromMinor(1000, iso.USD);

    expect(() => rate.convert(amount)).toThrow(MoneyError);
    try {
      rate.convert(amount);
    } catch (error) {
      expect((error as MoneyError).kind).toBe("InvalidCurrency");
    }
  });

  it("reports a currency error before an overflow", () => {
    const rate = new ExchangeRate(iso.GBP, iso.EUR, Decimal.fromString("2")!);
    const amount = Money.fromDecimal(Decimal.MAX, iso.USD);

    try {
      rate.convert(amount);
      throw new Error("expected the conversion to fail");
    } catch (error) {
      expect((error as MoneyError).kind).toBe("InvalidCurrency");
    }
  });

  it("reports an overflow", () => {
    const rate = new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("2")!);

    for (const amount of [Decimal.MAX, Decimal.MIN]) {
      const money = Money.fromDecimal(amount, iso.USD);
      try {
        rate.convert(money);
        throw new Error("expected the conversion to fail");
      } catch (error) {
        expect((error as MoneyError).kind).toBe("Overflow");
      }
    }
  });

  it("converts at the decimal limits", () => {
    for (const multiplier of ["1", "0", "-1"]) {
      const rate = new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString(multiplier)!);
      for (const amount of [Decimal.MAX, Decimal.MIN]) {
        const money = Money.fromDecimal(amount, iso.USD);
        const converted = rate.convert(money);

        expect(converted.amount.equals(amount.multiply(Decimal.fromString(multiplier)!))).toBe(
          true,
        );
      }
    }
  });

  it("supports a zero rate", () => {
    const rate = new ExchangeRate(iso.USD, iso.EUR, Decimal.ZERO);
    const converted = rate.convert(Money.fromMinor(1000, iso.USD));

    expect(converted.isZero()).toBe(true);
  });

  it("supports a negative rate", () => {
    const rate = new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("-1.5")!);
    const converted = rate.convert(Money.fromMinor(1000, iso.USD));

    expect(converted.equals(Money.fromMinor(-1500, iso.EUR))).toBe(true);
  });
});

describe("Exchange", () => {
  it("stores and fetches rates", () => {
    const usdToEur = new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("1.5")!);
    const usdToGbp = new ExchangeRate(iso.USD, iso.GBP, Decimal.fromString("1.6")!);

    const exchange = new Exchange();
    exchange.setRate(usdToEur);
    exchange.setRate(usdToGbp);

    expect(exchange.getRate(iso.USD, iso.EUR)?.rate.equals(Decimal.fromString("1.5")!)).toBe(true);
    expect(exchange.getRate(iso.USD, iso.GBP)?.rate.equals(Decimal.fromString("1.6")!)).toBe(true);
    expect(exchange.getRate(iso.EUR, iso.USD)).toBeUndefined();
  });

  it("accepts rates in the constructor", () => {
    const usdToEur = new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("1.5")!);
    const exchange = new Exchange([usdToEur]);

    expect(exchange.hasRate(iso.USD, iso.EUR)).toBe(true);
  });

  it("removes rates", () => {
    const exchange = new Exchange([new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("1.5")!)]);

    expect(exchange.removeRate(iso.USD, iso.EUR)).toBe(true);
    expect(exchange.removeRate(iso.USD, iso.EUR)).toBe(false);
    expect(exchange.hasRate(iso.USD, iso.EUR)).toBe(false);
  });
});

describe("Money.exchangeTo", () => {
  it("converts with the stored rate", () => {
    const exchange = new Exchange([new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("1.5")!)]);
    const converted = Money.fromMinor(1000, iso.USD).exchangeTo(iso.EUR, exchange);

    expect(converted.equals(Money.fromMinor(1500, iso.EUR))).toBe(true);
  });

  it("fails without a rate", () => {
    const exchange = new Exchange();

    expect(() => Money.fromMinor(1000, iso.USD).exchangeTo(iso.EUR, exchange)).toThrow(MoneyError);
    try {
      Money.fromMinor(1000, iso.USD).exchangeTo(iso.EUR, exchange);
    } catch (error) {
      expect((error as MoneyError).kind).toBe("InvalidCurrency");
    }
  });

  it("converts between cryptocurrencies", () => {
    const exchange = new Exchange([
      new ExchangeRate(crypto.BTC, crypto.ETH, Decimal.fromString("30")!),
    ]);
    const converted = Money.fromMinor(100_000_000n, crypto.BTC).exchangeTo(crypto.ETH, exchange);

    expect(converted.currency).toBe(crypto.ETH);
    expect(converted.amount.toString()).toBe("30.00000000");
  });
});
