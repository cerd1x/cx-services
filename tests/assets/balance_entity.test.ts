import { describe, test, expect } from "bun:test";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";

describe("Balance", () => {
  describe("init", () => {
    test("creates Balance from valid IDR format", () => {
      const balance = Balance.new("IDR 500000");
      expect(balance).toBeDefined();
      expect(balance.value).toBe(500000);
    });

    test("creates Balance with USD", () => {
      const balance = Balance.new("USD 100");
      expect(balance).toBeDefined();
      expect(balance.value).toBe(100);
    });

    test("throws on invalid format", () => {
      expect(() => Balance.new("invalid")).toThrow();
    });

    test("throws on empty string", () => {
      expect(() => Balance.new("")).toThrow();
    });
  });

  describe("parse", () => {
    test("parses decimal amount", () => {
      const balance = Balance.new("USD 100.50");
      expect(balance.value).toBe(100.5);
    });

    test("parses amount with thousands separator", () => {
      const balance = Balance.new("IDR 1,000,000");
      expect(balance.value).toBe(1000000);
    });

    test("parses negative amount", () => {
      const balance = Balance.new("USD -100");
      expect(balance.value).toBe(-100);
    });

    test("trims surrounding whitespace", () => {
      const balance = Balance.new("  IDR 500  ");
      expect(balance.value).toBe(500);
    });

    test("throws on lowercase currency code", () => {
      expect(() => Balance.new("usd 100")).toThrow();
    });

    test("throws on unknown ISO code", () => {
      expect(() => Balance.new("XXX 100")).toThrow("Currency must be a 3-letter code: XXX");
    });

    test("throws on wrong currency length", () => {
      expect(() => Balance.new("US 100")).toThrow();
      expect(() => Balance.new("USDD 100")).toThrow();
    });

    test("throws when currency and amount are not separated by space", () => {
      expect(() => Balance.new("USD100")).toThrow();
    });

    test("throws when amount is missing", () => {
      expect(() => Balance.new("USD")).toThrow();
    });

    test("throws on amount with multiple decimal points", () => {
      expect(() => Balance.new("USD 100.50.25")).toThrow();
    });

    test("throws on amount with letters", () => {
      expect(() => Balance.new("USD 1O0")).toThrow();
    });
  });

  describe("is", () => {
    test("returns true for Balance instance", () => {
      expect(Balance.is(Balance.new("IDR 100"))).toBe(true);
    });

    test("returns true for valid balance string", () => {
      expect(Balance.is("USD 100")).toBe(true);
    });

    test("returns false for invalid string", () => {
      expect(Balance.is("garbage")).toBe(false);
      expect(Balance.is("XXX 100")).toBe(false);
    });

    test("returns false for other types", () => {
      expect(Balance.is(100)).toBe(false);
      expect(Balance.is(null)).toBe(false);
    });
  });

  describe("toLocalStr", () => {
    test("formats IDR balance with id-ID locale", () => {
      const balance = Balance.new("IDR 1000000");
      expect(balance.toLocalStr).toBe("Rp\u00a01.000.000,00");
    });

    test("formats USD balance with en-US locale", () => {
      const balance = Balance.new("USD 100");
      expect(balance.toLocalStr).toBe("$100.00");
    });

    test("formats JPY balance with ja-JP locale", () => {
      const balance = Balance.new("JPY 1000");
      expect(balance.toLocalStr).toContain("1,000");
    });
  });

  describe("value", () => {
    test("returns the numeric amount", () => {
      const balance = Balance.new("IDR 500000");
      expect(balance.value).toBe(500000);
    });

    test("handles small amounts", () => {
      const balance = Balance.new("USD 50");
      expect(balance.value).toBe(50);
    });
  });

  describe("currency", () => {
    test("returns IDR code", () => {
      const balance = Balance.new("IDR 500000");
      expect(balance.code).toBe("IDR");
    });

    test("returns USD code", () => {
      const balance = Balance.new("USD 100");
      expect(balance.code).toBe("USD");
    });
  });

  describe("add", () => {
    test("adds two balances together", () => {
      const a = Balance.new("IDR 100000");
      const b = Balance.new("IDR 50000");
      a.add(b);
      expect(a.value).toBe(150000);
    });

    test("works with zero", () => {
      const a = Balance.new("IDR 100000");
      const b = Balance.new("IDR 0");
      a.add(b);
      expect(a.value).toBe(100000);
    });
  });

  describe("subtract", () => {
    test("subtracts balance from another", () => {
      const a = Balance.new("IDR 100000");
      const b = Balance.new("IDR 30000");
      a.subtract(b);
      expect(a.value).toBe(70000);
    });

    test("result can be zero", () => {
      const a = Balance.new("IDR 50000");
      const b = Balance.new("IDR 50000");
      a.subtract(b);
      expect(a.value).toBe(0);
    });
  });
});
