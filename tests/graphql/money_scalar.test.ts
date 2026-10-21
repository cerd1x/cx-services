import { describe, expect, it } from "bun:test";
import { Kind, type StringValueNode, type IntValueNode } from "graphql";
import { Money, iso } from "@lib/money";
import {
  MoneyResolver,
  parseMoneyValue,
  serializeMoneyValue,
} from "$services/shared/infra/graphql/scalars/money";

describe("Money scalar", () => {
  describe("parseMoneyValue", () => {
    it("parses ISO code + nominal into a Money instance", () => {
      const money = parseMoneyValue("IDR 1500000");

      expect(money).toBeInstanceOf(Money);
      expect(money.currency.code).toBe("IDR");
      expect(money.toNumber()).toBe(1500000);
    });

    it("parses decimal amounts", () => {
      expect(parseMoneyValue("USD 100.50").toNumber()).toBe(100.5);
    });

    it("ignores thousands separators", () => {
      expect(parseMoneyValue("IDR 1,500,000").toNumber()).toBe(1500000);
    });

    it("rounds to the currency exponent", () => {
      expect(parseMoneyValue("USD 100.555").toNumber()).toBe(100.56);
      expect(parseMoneyValue("JPY 100.5").toNumber()).toBe(101);
    });

    it("accepts negative amounts", () => {
      expect(parseMoneyValue("IDR -5000").toNumber()).toBe(-5000);
    });

    it("stores the amount at the currency exponent scale", () => {
      expect(parseMoneyValue("IDR 1500000").toJSON()).toEqual({
        amount: "1500000.00",
        currency: "IDR",
      });
    });

    it("rejects malformed values", () => {
      expect(() => parseMoneyValue("1500000")).toThrow(/Invalid money format/);
      expect(() => parseMoneyValue("IDR")).toThrow(/Invalid money format/);
      expect(() => parseMoneyValue("idr 100")).toThrow(/Invalid money format/);
      expect(() => parseMoneyValue("IDR 100 USD")).toThrow(/Invalid money format/);
    });

    it("rejects unknown currency codes", () => {
      expect(() => parseMoneyValue("XYZ 100")).toThrow("Currency must be a 3-letter code: XYZ");
    });

    it("rejects non-spendable ISO codes", () => {
      for (const code of ["XXX", "XDR", "XBA", "XTS", "XUA"]) {
        expect(() => parseMoneyValue(`${code} 100`)).toThrow(
          `Currency must be a 3-letter code: ${code}`,
        );
      }
    });

    it("rejects ticker kripto yang bukan kode ISO", () => {
      expect(() => parseMoneyValue("BTC 1")).toThrow("Currency must be a 3-letter code: BTC");
    });
  });

  describe("serializeMoneyValue", () => {
    it("renders a Money as ISO code + nominal", () => {
      expect(serializeMoneyValue(Money.fromNumber(1500000, iso.IDR))).toBe("IDR 1500000");
      expect(serializeMoneyValue(Money.fromNumber(100.5, iso.USD))).toBe("USD 100.5");
    });

    it("round-trips with parseMoneyValue", () => {
      for (const wire of ["IDR 1500000", "USD 100.5", "IDR -5000", "CHF 50"]) {
        expect(serializeMoneyValue(parseMoneyValue(wire))).toBe(wire);
      }
    });
  });

  describe("MoneyResolver", () => {
    it("serializes Money values", () => {
      expect(MoneyResolver.serialize(Money.fromNumber(1500000, iso.IDR))).toBe("IDR 1500000");
    });

    it("refuses to serialize non-Money values", () => {
      expect(() => MoneyResolver.serialize("IDR 1500000")).toThrow(/cannot serialize/);
      expect(() => MoneyResolver.serialize(1500000)).toThrow(/cannot serialize/);
    });

    it("parses variables as string", () => {
      const parsed = MoneyResolver.parseValue("IDR 250000") as Money;

      expect(parsed).toBeInstanceOf(Money);
      expect(parsed.toNumber()).toBe(250000);
    });

    it("refuses non-string variables", () => {
      expect(() => MoneyResolver.parseValue(250000)).toThrow(/expected string/);
    });

    it("parses string literals", () => {
      const literal: StringValueNode = { kind: Kind.STRING, value: "USD 12.50" };
      const parsed = MoneyResolver.parseLiteral(literal, undefined) as Money;

      expect(parsed.toNumber()).toBe(12.5);
    });

    it("refuses non-string literals", () => {
      const literal: IntValueNode = { kind: Kind.INT, value: "250000" };

      expect(() => MoneyResolver.parseLiteral(literal, undefined)).toThrow(
        /expected String literal/,
      );
    });
  });
});
