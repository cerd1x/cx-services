import { describe, expect, it } from "bun:test";
import { Money } from "@lib/money";
import {
  findSpendableCurrency,
  formatMoney,
  isoCodeList,
  parseMoney,
} from "$services/shared/kernel/money";

describe("money codec", () => {
  describe("parseMoney", () => {
    it("parses valid IDR format", () => {
      const money = parseMoney("IDR 500000");
      expect(money).toBeInstanceOf(Money);
      expect(money.toNumber()).toBe(500000);
      expect(money.currency.code).toBe("IDR");
    });

    it("parses USD", () => {
      const money = parseMoney("USD 100");
      expect(money.toNumber()).toBe(100);
      expect(money.currency.code).toBe("USD");
    });

    it("throws on invalid format", () => {
      expect(() => parseMoney("invalid")).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => parseMoney("")).toThrow();
    });

    it("parses decimal amount", () => {
      expect(parseMoney("USD 100.50").toNumber()).toBe(100.5);
    });

    it("parses amount with thousands separator", () => {
      expect(parseMoney("IDR 1,000,000").toNumber()).toBe(1000000);
    });

    it("parses negative amount", () => {
      expect(parseMoney("USD -100").toNumber()).toBe(-100);
    });

    it("trims surrounding whitespace", () => {
      expect(parseMoney("  IDR 500  ").toNumber()).toBe(500);
    });

    it("throws on lowercase currency code", () => {
      expect(() => parseMoney("usd 100")).toThrow();
    });

    it("throws on unknown ISO code", () => {
      expect(() => parseMoney("XXX 100")).toThrow("Currency must be a 3-letter code: XXX");
    });

    it("throws on wrong currency length", () => {
      expect(() => parseMoney("US 100")).toThrow();
      expect(() => parseMoney("USDD 100")).toThrow();
    });

    it("throws when currency and amount are not separated by space", () => {
      expect(() => parseMoney("USD100")).toThrow();
    });

    it("throws when amount is missing", () => {
      expect(() => parseMoney("USD")).toThrow();
    });

    it("throws on amount with multiple decimal points", () => {
      expect(() => parseMoney("USD 100.50.25")).toThrow();
    });

    it("throws on amount with letters", () => {
      expect(() => parseMoney("USD 1O0")).toThrow();
    });
  });

  describe("formatMoney", () => {
    it("formats money as ISO CODE + VALUE", () => {
      expect(formatMoney(parseMoney("IDR 500000"))).toBe("IDR 500000");
      expect(formatMoney(parseMoney("USD 100"))).toBe("USD 100");
    });

    it("formats decimal amounts without trailing zeroes", () => {
      expect(formatMoney(parseMoney("USD 100.50"))).toBe("USD 100.5");
    });
  });

  describe("findSpendableCurrency", () => {
    it("returns the currency descriptor", () => {
      expect(findSpendableCurrency("IDR").code).toBe("IDR");
    });

    it("throws for non-spendable codes", () => {
      expect(() => findSpendableCurrency("XXX")).toThrow("Currency must be a 3-letter code: XXX");
    });
  });

  describe("isoCodeList", () => {
    it("excludes non-spendable ISO codes", () => {
      expect(isoCodeList).toContain("IDR");
      expect(isoCodeList).toContain("USD");
      expect(isoCodeList).not.toContain("XXX");
    });
  });

  describe("Money operations", () => {
    it("adds two amounts", () => {
      const total = parseMoney("IDR 100000").add(parseMoney("IDR 50000"));
      expect(total.toNumber()).toBe(150000);
    });

    it("subtracts an amount", () => {
      const rest = parseMoney("IDR 100000").subtract(parseMoney("IDR 30000"));
      expect(rest.toNumber()).toBe(70000);
    });

    it("subtracts to zero", () => {
      const rest = parseMoney("IDR 50000").subtract(parseMoney("IDR 50000"));
      expect(rest.toNumber()).toBe(0);
      expect(rest.isZero()).toBe(true);
    });

    it("does not mutate the source amount", () => {
      const source = parseMoney("IDR 100000");
      source.add(parseMoney("IDR 50000"));
      expect(source.toNumber()).toBe(100000);
    });

    it("throws when currencies do not match", () => {
      expect(() => parseMoney("IDR 100").add(parseMoney("USD 100"))).toThrow();
    });
  });
});
