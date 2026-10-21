import { describe, expect, it } from "bun:test";
import {
  Decimal,
  Money,
  MoneyError,
  Round,
  crypto,
  defineFiatCurrency,
  iso,
  isMoneyError,
} from "@lib/money";

/** Mirrors the `test` currency set of the Rust crate. */
const spaceCurrency = defineFiatCurrency({
  isoAlphaCode: "USD",
  isoNumericCode: "840",
  exponent: 2,
  locale: "EnBy",
  minorUnits: 100,
  name: "USD",
  symbol: "$",
  symbolFirst: true,
});

describe("Money", () => {
  describe("construction", () => {
    it("treats major and minor units as equivalent", () => {
      const major = Money.fromMajor(10, iso.USD);
      const minor = Money.fromMinor(1000, iso.USD);

      expect(major.equals(minor)).toBe(true);
      expect(major.currency).toBe(iso.USD);
      expect(minor.currency).toBe(iso.USD);
    });

    it("formats major and minor units identically", () => {
      const fromMinor = Money.fromMinor(10000, iso.USD);
      const fromMajor = Money.fromMajor(100, iso.USD);

      expect(fromMinor.toString()).toBe(fromMajor.toString());
      expect(fromMajor.toString()).toBe("$100.00");
    });

    it("formats European major and minor units identically", () => {
      const fromMinor = Money.fromMinor(10000, iso.EUR);
      const fromMajor = Money.fromMajor(100, iso.EUR);

      expect(fromMinor.toString()).toBe(fromMajor.toString());
      expect(fromMajor.toString()).toBe("€100,00");
    });

    it("handles a zero exponent", () => {
      const fromMinor = Money.fromMinor(100, iso.JPY);
      const fromMajor = Money.fromMajor(100, iso.JPY);

      expect(fromMinor.equals(fromMajor)).toBe(true);
      expect(fromMinor.toString()).toBe("¥100");
    });

    it("creates a zero amount", () => {
      expect(Money.zero(iso.USD).isZero()).toBe(true);
      expect(Money.zero(iso.USD).toString()).toBe("$0.00");
    });
  });

  describe("fromString", () => {
    it("preserves normalized values and scales", () => {
      const cases: Array<[string, typeof iso.USD, string]> = [
        ["1234", iso.USD, "1234.00"],
        ["1234", iso.JPY, "1234"],
        ["1.50", iso.JPY, "1.50"],
        ["1,234.500", iso.USD, "1234.500"],
        ["1.234,500", iso.EUR, "1234.500"],
        ["1,23,456.7800", iso.INR, "123456.7800"],
        ["1 234,50", spaceCurrency, "1234.50"],
        ["-0", iso.USD, "0.00"],
        ["0.0000", iso.USD, "0.0000"],
        [".50", iso.USD, "0.50"],
        ["+1.50", iso.USD, "1.50"],
        ["1_234.50", iso.USD, "1234.50"],
        [",123.45", iso.USD, "123.45"],
        ["12,34,567,890,123.00", iso.USD, "1234567890123.00"],
        ["79228162514264337593543950335", iso.USD, "79228162514264337593543950335"],
      ];

      for (const [input, currency, expected] of cases) {
        const money = Money.fromString(input, currency);
        expect(money.amount.toString()).toBe(expected);
        expect(money.amount.coefficient).toBe(Decimal.fromString(expected)!.coefficient);
        expect(money.amount.scale).toBe(Decimal.fromString(expected)!.scale);
      }
    });

    it("parses signs", () => {
      expect(Money.fromString("-3", iso.GBP).equals(Money.fromMinor(-300, iso.GBP))).toBe(true);
      expect(Money.fromString("+3", iso.GBP).equals(Money.fromMinor(300, iso.GBP))).toBe(true);
    });

    it("ignores separators", () => {
      expect(
        Money.fromString("1,000,000", iso.GBP).equals(Money.fromMinor(100000000, iso.GBP)),
      ).toBe(true);
    });

    it("rejects invalid amounts", () => {
      const cases: Array<[string, typeof iso.USD]> = [
        ["1.0000,000", iso.GBP],
        ["1.0000.000", iso.GBP],
        ["1.0000!000", iso.GBP],
        [",", iso.GBP],
        [".", iso.GBP],
        [",,.", iso.GBP],
        ["   ", iso.USD],
        [" 100 ", iso.USD],
        ["", iso.USD],
        ["1,00.00", iso.GBP],
        ["1.00,00", iso.EUR],
        ["1.00.000,00", iso.EUR],
        ["1.00.000.000,00", iso.EUR],
        ["1,00.00", iso.INR],
        ["1.000.000.00", iso.INR],
        ["1.", iso.USD],
        ["1.+1", iso.USD],
        ["1.-1", iso.USD],
        ["1.1_0", iso.USD],
        ["1.1a", iso.USD],
        ["1.1 0", iso.USD],
        ["1.1,000", iso.USD],
        ["1.１２", iso.USD],
        ["1.1.2", iso.USD],
      ];

      for (const [input, currency] of cases) {
        expect(() => Money.fromString(input, currency)).toThrow(MoneyError);
        try {
          Money.fromString(input, currency);
          throw new Error(`expected ${input} to be rejected`);
        } catch (error) {
          expect(isMoneyError(error)).toBe(true);
          expect((error as MoneyError).kind).toBe("InvalidAmount");
        }
      }
    });
  });

  describe("arithmetic", () => {
    it("adds and subtracts", () => {
      const base = Money.fromMinor(1000, iso.USD);

      expect(base.add(Money.fromMinor(250, iso.USD)).toMinorUnits()).toBe(1250n);
      expect(base.subtract(Money.fromMinor(250, iso.USD)).toMinorUnits()).toBe(750n);
    });

    it("multiplies and divides", () => {
      const base = Money.fromMinor(1000, iso.USD);

      expect(base.multiply(2).toMinorUnits()).toBe(2000n);
      expect(base.multiply(1.5).toMinorUnits()).toBe(1500n);
      expect(base.divide(2).toMinorUnits()).toBe(500n);
    });

    it("keeps the original amount untouched", () => {
      const base = Money.fromMinor(1000, iso.USD);
      base.add(Money.fromMinor(250, iso.USD));

      expect(base.toMinorUnits()).toBe(1000n);
    });

    it("rejects mismatched currencies", () => {
      const usd = Money.fromMinor(1000, iso.USD);
      const eur = Money.fromMinor(1000, iso.EUR);

      expect(() => usd.add(eur)).toThrow(MoneyError);
      expect(() => usd.subtract(eur)).toThrow(MoneyError);
      expect(() => usd.compare(eur)).toThrow(MoneyError);
      expect(() => usd.equals(eur)).toThrow(MoneyError);

      try {
        usd.add(eur);
      } catch (error) {
        expect((error as MoneyError).kind).toBe("CurrencyMismatch");
        expect((error as MoneyError).expected).toBe("USD");
        expect((error as MoneyError).actual).toBe("EUR");
      }
    });

    it("rejects a division by zero", () => {
      const base = Money.fromMinor(1000, iso.USD);

      expect(() => base.divide(0)).toThrow(MoneyError);
      try {
        base.divide(0);
      } catch (error) {
        expect((error as MoneyError).kind).toBe("DivisionByZero");
      }
    });

    it("rejects an overflow", () => {
      const huge = Money.fromMajor(79228162514264337593543950335n, iso.USD);

      expect(() => huge.add(huge)).toThrow(MoneyError);
      try {
        huge.multiply(10);
      } catch (error) {
        expect((error as MoneyError).kind).toBe("Overflow");
      }
    });
  });

  describe("comparison", () => {
    const base = Money.fromMinor(1000, iso.USD);

    it("compares amounts", () => {
      const bigger = Money.fromMinor(1001, iso.USD);
      const smaller = Money.fromMinor(999, iso.USD);

      expect(base.compare(bigger)).toBe(-1);
      expect(base.compare(smaller)).toBe(1);
      expect(base.compare(Money.fromMajor(10, iso.USD))).toBe(0);
      expect(base.gt(smaller)).toBe(true);
      expect(base.gte(base)).toBe(true);
      expect(base.lt(bigger)).toBe(true);
      expect(base.lte(base)).toBe(true);
    });

    it("reports the sign of the amount", () => {
      expect(base.isPositive()).toBe(true);
      expect(base.isNegative()).toBe(false);
      expect(base.isZero()).toBe(false);
      expect(Money.zero(iso.USD).isZero()).toBe(true);
    });

    it("returns the absolute value", () => {
      expect(Money.fromMinor(-1000, iso.USD).abs().toMinorUnits()).toBe(1000n);
    });
  });

  describe("minor units", () => {
    it("truncates fractional minor units", () => {
      expect(Money.fromString("1.005", iso.USD).toMinorUnits()).toBe(100n);
      expect(Money.fromString("-1.005", iso.USD).toMinorUnits()).toBe(-100n);
    });

    it("converts exactly or reports a precision loss", () => {
      expect(Money.fromString("1.50", iso.USD).tryToMinorUnits()).toBe(150n);
      expect(() => Money.fromString("1.005", iso.USD).tryToMinorUnits()).toThrow(MoneyError);

      try {
        Money.fromString("1.005", iso.USD).tryToMinorUnits();
      } catch (error) {
        expect((error as MoneyError).kind).toBe("PrecisionLoss");
      }
    });

    it("handles cryptocurrencies with a large exponent", () => {
      const bitcoin = Money.fromMinor(100_000_000n, crypto.BTC);
      expect(bitcoin.toMinorUnits()).toBe(100_000_000n);
      expect(bitcoin.toString()).toBe("₿1.00000000");

      const ethereum = Money.fromMinor(1_000_000_000_000_000_000n, crypto.ETH);
      expect(ethereum.toMinorUnits()).toBe(1_000_000_000_000_000_000n);
      expect(ethereum.toString()).toBe("1.000000000000000000ETH");
    });
  });

  describe("rounding", () => {
    it("rounds with the requested strategy", () => {
      const value = Money.fromString("-1.005", iso.USD);

      expect(value.round(2, Round.HalfUp).amount.toString()).toBe("-1.01");
      expect(value.round(2, Round.HalfDown).amount.toString()).toBe("-1.00");
      expect(value.round(2, Round.HalfEven).amount.toString()).toBe("-1.00");
    });

    it("keeps the original amount untouched", () => {
      const value = Money.fromString("1.005", iso.USD);
      value.round(2, Round.HalfUp);

      expect(value.amount.toString()).toBe("1.005");
    });
  });

  describe("split", () => {
    it("splits an amount equally", () => {
      const shares = Money.fromMinor(1000, iso.USD).split(3);

      expect(shares.map((share) => share.toMinorUnits())).toEqual([334n, 333n, 333n]);
    });

    it("conserves the total", () => {
      const money = Money.fromMinor(1000, iso.USD);
      const total = money.split(3).reduce((sum, share) => sum + share.toMinorUnits(), 0n);

      expect(total).toBe(money.toMinorUnits());
    });

    it("floors negative amounts", () => {
      const shares = Money.fromString("-1.005", iso.USD).split(2);

      expect(shares.map((share) => share.toMinorUnits())).toEqual([-50n, -51n]);
    });

    it("rejects an invalid ratio", () => {
      expect(() => Money.fromMinor(1000, iso.USD).split(0)).toThrow(MoneyError);
      expect(() => Money.fromMinor(1000, iso.USD).split(-1)).toThrow(MoneyError);
      expect(() => Money.fromMinor(1000, iso.USD).split(1.5)).toThrow(MoneyError);
    });
  });

  describe("allocate", () => {
    it("allocates by weight", () => {
      const allocations = Money.fromMinor(1000, iso.USD).allocate([1, 1, 1]);

      expect(allocations.map((share) => share.toMinorUnits())).toEqual([334n, 333n, 333n]);
    });

    it("conserves the total", () => {
      const money = Money.fromMinor(1000, iso.USD);
      const total = money
        .allocate([3, 3, 4])
        .reduce((sum, share) => sum + share.toMinorUnits(), 0n);

      expect(total).toBe(money.toMinorUnits());
    });

    it("gives the remainder to the first non-zero weights", () => {
      const allocations = Money.fromMinor(1000, iso.USD).allocate([1, 0, 0]);

      expect(allocations.map((share) => share.toMinorUnits())).toEqual([1000n, 0n, 0n]);
    });

    it("rejects invalid weights", () => {
      expect(() => Money.fromMinor(1000, iso.USD).allocate([])).toThrow(MoneyError);
      expect(() => Money.fromMinor(1000, iso.USD).allocate([0, 0])).toThrow(MoneyError);
      expect(() => Money.fromMinor(1000, iso.USD).allocate([-1, 2])).toThrow(MoneyError);
    });
  });

  describe("serialization", () => {
    it("serializes the amount and the currency", () => {
      expect(Money.fromMinor(1234, iso.USD).toJSON()).toEqual({
        amount: "12.34",
        currency: "USD",
      });
    });
  });
});
