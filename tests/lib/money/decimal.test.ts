import { describe, expect, it } from "bun:test";
import {
  DECIMAL_MAX_COEFFICIENT,
  DECIMAL_MAX_SCALE,
  Decimal,
  DecimalError,
} from "$services/lib/money";

function decimal(text: string): Decimal {
  const parsed = Decimal.fromString(text);
  if (!parsed) throw new Error(`cannot parse ${text}`);
  return parsed;
}

describe("Decimal", () => {
  describe("parsing", () => {
    it("parses plain values", () => {
      expect(decimal("0").toString()).toBe("0");
      expect(decimal("1").toString()).toBe("1");
      expect(decimal("-1").toString()).toBe("-1");
      expect(decimal("+1").toString()).toBe("1");
      expect(decimal("1.5").toString()).toBe("1.5");
      expect(decimal("-1.5").toString()).toBe("-1.5");
      expect(decimal(".5").toString()).toBe("0.5");
      expect(decimal("1.").toString()).toBe("1");
    });

    it("keeps the scale", () => {
      expect(decimal("1.50").scale).toBe(2);
      expect(decimal("1.50").coefficient).toBe(150n);
      expect(decimal("0.0000").scale).toBe(4);
    });

    it("ignores digit separators", () => {
      expect(decimal("1_234.50").toString()).toBe("1234.50");
    });

    it("rejects invalid literals", () => {
      for (const text of ["", "abc", "1.2.3", "1..2", "1 2", "1-2", "_1", "."]) {
        expect(Decimal.fromString(text)).toBeNull();
      }
    });

    it("allows a trailing separator", () => {
      expect(decimal("1_").toString()).toBe("1");
    });

    it("normalizes a negative zero", () => {
      expect(decimal("-0").coefficient).toBe(0n);
      expect(decimal("-0").isNegative()).toBe(false);
    });

    it("caps the scale at 28 digits", () => {
      const value = decimal("1.0000000000000000000000000001");

      expect(value.scale).toBe(DECIMAL_MAX_SCALE);
    });

    it("rejects a coefficient above 96 bits", () => {
      expect(() => new Decimal(DECIMAL_MAX_COEFFICIENT + 1n)).toThrow(DecimalError);
      expect(() => new Decimal(1n, DECIMAL_MAX_SCALE + 1)).toThrow(DecimalError);
    });
  });

  describe("arithmetic", () => {
    it("adds and subtracts", () => {
      expect(decimal("1.5").add(decimal("2.25")).toString()).toBe("3.75");
      expect(decimal("1.5").subtract(decimal("2.25")).toString()).toBe("-0.75");
      expect(decimal("-1.5").add(decimal("1.5")).toString()).toBe("0.0");
    });

    it("multiplies", () => {
      expect(decimal("1.5").multiply(decimal("2")).toString()).toBe("3.0");
      expect(decimal("0.1").multiply(decimal("0.2")).toString()).toBe("0.02");
    });

    it("divides", () => {
      expect(decimal("10").divide(decimal("3")).toString()).toBe("3.3333333333333333333333333333");
      expect(decimal("10").divide(decimal("2")).toString()).toBe("5");
      expect(decimal("1").divide(decimal("8")).toString()).toBe("0.125");
    });

    it("rejects a division by zero", () => {
      expect(() => decimal("1").divide(Decimal.ZERO)).toThrow(DecimalError);
    });

    it("rejects an overflow", () => {
      expect(() => Decimal.MAX.add(Decimal.MAX)).toThrow(DecimalError);
      expect(() => Decimal.MAX.multiply(decimal("10"))).toThrow(DecimalError);
    });
  });

  describe("comparison", () => {
    it("ignores the scale", () => {
      expect(decimal("1.50").equals(decimal("1.5"))).toBe(true);
      expect(decimal("1.50").compare(decimal("1.5"))).toBe(0);
    });

    it("orders values", () => {
      expect(decimal("1").compare(decimal("2"))).toBe(-1);
      expect(decimal("2").compare(decimal("1"))).toBe(1);
      expect(decimal("-1").compare(decimal("1"))).toBe(-1);
    });

    it("reports the sign", () => {
      expect(decimal("1").isPositive()).toBe(true);
      expect(decimal("-1").isNegative()).toBe(true);
      expect(decimal("0").isZero()).toBe(true);
    });

    it("takes the absolute value and negates", () => {
      expect(decimal("-1.5").abs().toString()).toBe("1.5");
      expect(decimal("1.5").negate().toString()).toBe("-1.5");
    });
  });

  describe("rounding", () => {
    it("rounds with each strategy", () => {
      expect(decimal("1.005").roundDp(2, "MidpointAwayFromZero").toString()).toBe("1.01");
      expect(decimal("1.005").roundDp(2, "MidpointTowardZero").toString()).toBe("1.00");
      expect(decimal("1.005").roundDp(2, "MidpointNearestEven").toString()).toBe("1.00");
      expect(decimal("1.015").roundDp(2, "MidpointNearestEven").toString()).toBe("1.02");
      expect(decimal("1.019").roundDp(2, "ToZero").toString()).toBe("1.01");
      expect(decimal("1.011").roundDp(2, "MidpointNearestEven").toString()).toBe("1.01");
    });

    it("rounds negative values away from zero", () => {
      expect(decimal("-1.005").roundDp(2, "MidpointAwayFromZero").toString()).toBe("-1.01");
      expect(decimal("-1.005").roundDp(2, "MidpointTowardZero").toString()).toBe("-1.00");
    });

    it("keeps the scale when rounding does not drop digits", () => {
      expect(decimal("1.5").roundDp(2, "MidpointNearestEven").toString()).toBe("1.5");
      expect(decimal("1.5").roundDp(0, "MidpointNearestEven").toString()).toBe("2");
    });

    it("rescales", () => {
      expect(decimal("1.5").rescale(3).toString()).toBe("1.500");
      expect(decimal("1.5").rescale(1).toString()).toBe("1.5");
      expect(decimal("1.55").rescale(1).toString()).toBe("1.6");
    });
  });

  describe("conversion", () => {
    it("converts to a number", () => {
      expect(decimal("1.5").toNumber()).toBe(1.5);
      expect(decimal("-0.25").toNumber()).toBe(-0.25);
    });

    it("builds from a number without binary artefacts", () => {
      expect(Decimal.fromNumber(0.1).toString()).toBe("0.1");
      expect(Decimal.fromNumber(1.5).toString()).toBe("1.5");
    });

    it("builds from a bigint", () => {
      expect(Decimal.fromBigInt(123n).toString()).toBe("123");
    });
  });
});
