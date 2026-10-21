/**
 * Ports of the behavioural tests of the `rusty-money` crate.
 *
 * These mirror the semantics of the original crate one-to-one, so a change in
 * behaviour shows up here first.
 */
import { describe, expect, it } from "bun:test";
import { Decimal, Exchange, ExchangeRate, Money, MoneyError, Round, crypto, iso } from "@lib/money";

describe("ported behaviour", () => {
  describe("construction", () => {
    it("parses a plain amount", () => {
      expect(Money.fromString("29.99", iso.GBP).equals(Money.fromMinor(2999, iso.GBP))).toBe(true);
    });

    it("parses 64 bit numbers", () => {
      const max = 9223372036854775807n;
      expect(Money.fromString(max.toString(), iso.GBP).equals(Money.fromMajor(max, iso.GBP))).toBe(
        true,
      );
    });

    it("preserves long fractional amounts", () => {
      const amounts = [
        "1.2147483648",
        "1.11111111111",
        "0.123456789012345678",
        "-1.123456789012345678",
        "0.1234567890123456789012345678",
      ];

      for (const amount of amounts) {
        const expected = Decimal.fromString(amount)!;
        for (const currency of [iso.USD, iso.EUR, iso.INR]) {
          const separator = currency.locale === "EnEu" ? "," : ".";
          const localized = amount.replace(".", separator);
          const money = Money.fromString(localized, currency);

          expect(money.amount.equals(expected)).toBe(true);
        }
      }
    });

    it("preserves ethereum fractional amounts", () => {
      for (const amount of ["1.11111111111", "0.123456789012345678"]) {
        const expected = Money.fromDecimal(Decimal.fromString(amount)!, crypto.ETH);

        expect(Money.fromString(amount, crypto.ETH).equals(expected)).toBe(true);
      }
    });

    it("rejects a currency with an unsupported exponent", () => {
      const custom = { ...iso.USD, exponent: 29 } as unknown as typeof iso.USD;

      expect(() => Money.fromMinor(1, custom)).toThrow(MoneyError);
      try {
        Money.fromMinor(1, custom);
      } catch (error) {
        expect((error as MoneyError).kind).toBe("InvalidAmount");
      }
    });
  });

  describe("arithmetic", () => {
    it("negates the amount", () => {
      const money = Money.fromMinor(100, iso.USD);

      expect(money.negate().equals(Money.fromMinor(-100, iso.USD))).toBe(true);
    });

    it("keeps the source value usable", () => {
      const money = Money.fromMajor(1, iso.USD);
      money.multiply(3);
      money.multiply(3);

      expect(money.toString()).toBe("$1.00");
    });

    it("multiplies with integers and decimals", () => {
      expect(Money.fromMinor(100, iso.USD).multiply(2).equals(Money.fromMinor(200, iso.USD))).toBe(
        true,
      );
      expect(
        Money.fromMinor(-100, iso.USD).multiply(-2).equals(Money.fromMinor(200, iso.USD)),
      ).toBe(true);
      expect(
        Money.fromMinor(100, iso.USD)
          .multiply(Decimal.fromParts(2n))
          .equals(Money.fromMinor(200, iso.USD)),
      ).toBe(true);
      expect(
        Money.fromMinor(400, iso.USD)
          .multiply(Decimal.fromParts(5n, 1))
          .equals(Money.fromMinor(200, iso.USD)),
      ).toBe(true);
    });

    it("divides with integers and decimals", () => {
      expect(Money.fromMinor(400, iso.USD).divide(2).equals(Money.fromMinor(200, iso.USD))).toBe(
        true,
      );
      expect(Money.fromMinor(-400, iso.USD).divide(-2).equals(Money.fromMinor(200, iso.USD))).toBe(
        true,
      );
      expect(
        Money.fromMinor(-200, iso.USD)
          .divide(Decimal.fromParts(-5n, 1))
          .equals(Money.fromMinor(400, iso.USD)),
      ).toBe(true);
    });

    it("succeeds at the decimal limits", () => {
      const zero = Money.fromMajor(0, iso.USD);

      for (const amount of [Decimal.MAX, Decimal.MIN]) {
        const money = Money.fromDecimal(amount, iso.USD);

        expect(money.add(zero).equals(money)).toBe(true);
        expect(money.subtract(zero).equals(money)).toBe(true);
        expect(money.divide(1).equals(money)).toBe(true);
        expect(money.divide(-1).equals(Money.fromDecimal(amount.negate(), iso.USD))).toBe(true);
      }

      const one = Money.fromMajor(1, iso.USD);
      const nearMax = Money.fromDecimal(Decimal.MAX.subtract(Decimal.ONE), iso.USD);
      const nearMin = Money.fromDecimal(Decimal.MIN.add(Decimal.ONE), iso.USD);

      expect(nearMax.add(one).amount.equals(Decimal.MAX)).toBe(true);
      expect(nearMin.subtract(one).amount.equals(Decimal.MIN)).toBe(true);
    });

    it("reports a currency mismatch before an overflow", () => {
      const money = Money.fromDecimal(Decimal.MAX, iso.USD);

      try {
        money.add(Money.fromMajor(1, iso.GBP));
        throw new Error("expected the addition to fail");
      } catch (error) {
        expect((error as MoneyError).kind).toBe("CurrencyMismatch");
      }
    });

    it("reports a division by zero at the decimal limits", () => {
      for (const amount of [Decimal.MAX, Decimal.MIN, Decimal.ZERO]) {
        const money = Money.fromDecimal(amount, iso.USD);

        expect(() => money.divide(0)).toThrow(MoneyError);
        expect(() => money.divide(Decimal.fromParts(0n, 2))).toThrow(MoneyError);
        try {
          money.divide(0);
        } catch (error) {
          expect((error as MoneyError).kind).toBe("DivisionByZero");
        }
      }
    });

    it("reports an overflow on division", () => {
      for (const amount of [Decimal.MAX, Decimal.MIN]) {
        const money = Money.fromDecimal(amount, iso.USD);

        for (const divisor of [Decimal.fromParts(1n, 1), Decimal.fromParts(-1n, 1)]) {
          expect(() => money.divide(divisor)).toThrow(MoneyError);
          try {
            money.divide(divisor);
          } catch (error) {
            expect((error as MoneyError).kind).toBe("Overflow");
          }
        }
      }
    });
  });

  describe("exchange", () => {
    it("converts a currency", () => {
      const exchange = new Exchange([
        new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("0.85")!),
      ]);
      const eur = Money.fromMinor(1000, iso.USD).exchangeTo(iso.EUR, exchange);

      expect(eur.equals(Money.fromMinor(850, iso.EUR))).toBe(true);
      expect(eur.currency).toBe(iso.EUR);
    });

    it("converts a zero amount", () => {
      const exchange = new Exchange([
        new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("0.85")!),
      ]);
      const eur = Money.fromMinor(0, iso.USD).exchangeTo(iso.EUR, exchange);

      expect(eur.isZero()).toBe(true);
      expect(eur.currency).toBe(iso.EUR);
    });

    it("preserves the sign", () => {
      const exchange = new Exchange([
        new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("0.85")!),
      ]);
      const eur = Money.fromMinor(-1000, iso.USD).exchangeTo(iso.EUR, exchange);

      expect(eur.isNegative()).toBe(true);
      expect(eur.equals(Money.fromMinor(-850, iso.EUR))).toBe(true);
    });

    it("reports an overflow", () => {
      const exchange = new Exchange([new ExchangeRate(iso.USD, iso.EUR, Decimal.fromParts(2n))]);

      for (const amount of [Decimal.MAX, Decimal.MIN]) {
        const money = Money.fromDecimal(amount, iso.USD);
        try {
          money.exchangeTo(iso.EUR, exchange);
          throw new Error("expected the conversion to fail");
        } catch (error) {
          expect((error as MoneyError).kind).toBe("Overflow");
        }
      }
    });
  });

  describe("allocation", () => {
    it("allocates by weight", () => {
      const allocated = Money.fromMinor(10000, iso.USD).allocate([70, 20, 10]);

      expect(allocated[0]?.equals(Money.fromMinor(7000, iso.USD))).toBe(true);
      expect(allocated[1]?.equals(Money.fromMinor(2000, iso.USD))).toBe(true);
      expect(allocated[2]?.equals(Money.fromMinor(1000, iso.USD))).toBe(true);
    });

    it("allocates an indivisible remainder", () => {
      const money = Money.fromMinor(1100, iso.USD);
      const expected = [367n, 367n, 366n];

      expect(money.allocate([1, 1, 1]).map((share) => share.toMinorUnits())).toEqual(expected);
      expect(money.split(3).map((share) => share.toMinorUnits())).toEqual(expected);
    });

    it("allows zero weights", () => {
      const allocated = Money.fromMinor(1000, iso.USD).allocate([1, 0, 0]);

      expect(allocated[0]?.toMinorUnits()).toBe(1000n);
      expect(allocated[1]?.toMinorUnits()).toBe(0n);
      expect(allocated[2]?.toMinorUnits()).toBe(0n);
    });

    it("skips zero weight recipients for the remainder", () => {
      const cases: Array<[number, number[], number[]]> = [
        [1, [0, 1, 1], [0, 1, 0]],
        [2, [1, 0, 1, 0, 1, 0], [1, 0, 1, 0, 0, 0]],
        [-1, [0, 1, 1], [0, 0, -1]],
        [-2, [0, 1, 0, 1, 0, 1, 0], [0, 0, 0, -1, 0, -1, 0]],
      ];

      for (const [amount, weights, expected] of cases) {
        const money = Money.fromMinor(amount, iso.USD);
        const allocated = money.allocate(weights);

        expect(allocated.map((share) => share.toMinorUnits())).toEqual(
          expected.map((value) => BigInt(value)),
        );
        expect(allocated.reduce((sum, share) => sum + share.amount.toNumber(), 0)).toBe(
          money.amount.toNumber(),
        );
      }
    });

    it("allocates a negative amount", () => {
      const money = Money.fromMinor(-1100, iso.USD);
      const allocated = money.allocate([1, 1, 1]);

      expect(allocated.reduce((sum, share) => sum + share.amount.toNumber(), 0)).toBe(
        money.amount.toNumber(),
      );
      for (const share of allocated) {
        expect(share.amount.compare(Decimal.ZERO)).toBeLessThanOrEqual(0);
      }
    });

    it("allocates a zero amount", () => {
      const allocated = Money.fromMinor(0, iso.USD).allocate([1, 1, 1]);

      for (const share of allocated) {
        expect(share.isZero()).toBe(true);
      }
    });

    it("allocates more shares than minor units", () => {
      const allocated = Money.fromMinor(100, iso.USD).allocate(new Array(101).fill(1));

      expect(allocated).toHaveLength(101);
      for (const share of allocated.slice(0, 100)) {
        expect(share.amount.toString()).toBe("0.01");
      }
      expect(allocated[100]?.isZero()).toBe(true);
    });

    it("allocates a zero exponent currency", () => {
      const allocated = Money.fromMinor(100, iso.JPY).allocate([1, 1, 1]);

      expect(allocated.map((share) => share.toMinorUnits())).toEqual([34n, 33n, 33n]);
    });

    it("keeps the total of a split", () => {
      for (const amount of [0, 1, 100, 1000, -1, -100, -1000]) {
        const money = Money.fromMinor(amount, iso.USD);
        const total = money.split(3).reduce((sum, share) => sum + share.toMinorUnits(), 0n);

        expect(total).toBe(money.toMinorUnits());
      }
    });

    it("keeps the total of an allocation", () => {
      for (const amount of [0, 1, 100, 1000, -1, -100, -1000]) {
        const money = Money.fromMinor(amount, iso.USD);
        const total = money
          .allocate([1, 2, 3])
          .reduce((sum, share) => sum + share.toMinorUnits(), 0n);

        expect(total).toBe(money.toMinorUnits());
      }
    });
  });

  describe("rounding", () => {
    it("rounds to the currency precision", () => {
      const usd = Money.fromMinor(2000, iso.USD).divide(3);
      expect(usd.round(2, Round.HalfEven).equals(Money.fromMinor(667, iso.USD))).toBe(true);

      const bhd = Money.fromMinor(20000, iso.BHD).divide(3);
      expect(bhd.round(3, Round.HalfEven).equals(Money.fromMinor(6667, iso.BHD))).toBe(true);
    });

    it("rounds half up at the boundary", () => {
      expect(Money.fromString("2.50", iso.USD).round(0, Round.HalfUp).amount.toString()).toBe("3");
      expect(Money.fromString("2.40", iso.USD).round(0, Round.HalfUp).amount.toString()).toBe("2");
    });

    it("rounds half down at the boundary", () => {
      expect(Money.fromString("2.50", iso.USD).round(0, Round.HalfDown).amount.toString()).toBe(
        "2",
      );
      expect(Money.fromString("2.60", iso.USD).round(0, Round.HalfDown).amount.toString()).toBe(
        "3",
      );
    });

    it("rounds half even to an even digit", () => {
      expect(Money.fromString("2.50", iso.USD).round(0, Round.HalfEven).amount.toString()).toBe(
        "2",
      );
      expect(Money.fromString("3.50", iso.USD).round(0, Round.HalfEven).amount.toString()).toBe(
        "4",
      );
    });

    it("rounds negative amounts", () => {
      expect(Money.fromString("-2.50", iso.USD).round(0, Round.HalfUp).amount.toString()).toBe(
        "-3",
      );
      expect(Money.fromString("-2.50", iso.USD).round(0, Round.HalfDown).amount.toString()).toBe(
        "-2",
      );
      expect(Money.fromString("-2.50", iso.USD).round(0, Round.HalfEven).amount.toString()).toBe(
        "-2",
      );
    });
  });

  describe("sign predicates", () => {
    it("treats a negative zero as zero", () => {
      const money = Money.fromString("-0.00", iso.USD);

      expect(money.isZero()).toBe(true);
      expect(money.isNegative()).toBe(false);
      expect(money.isPositive()).toBe(false);
    });

    it("returns the absolute value", () => {
      expect(Money.fromMinor(-100, iso.USD).abs().equals(Money.fromMinor(100, iso.USD))).toBe(true);
      expect(Money.fromMinor(100, iso.USD).abs().equals(Money.fromMinor(100, iso.USD))).toBe(true);
    });
  });
});
