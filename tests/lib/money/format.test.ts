import { describe, expect, it } from "bun:test";
import {
  DEFAULT_FORMAT_PARAMS,
  Decimal,
  Formatter,
  Money,
  Position,
  iso,
  type FormatParams,
} from "@lib/money";

function params(overrides: Partial<FormatParams> = {}): FormatParams {
  return { ...DEFAULT_FORMAT_PARAMS, ...overrides };
}

describe("Formatter", () => {
  describe("golden values", () => {
    it("formats USD", () => {
      expect(Money.fromMinor(0, iso.USD).toString()).toBe("$0.00");
      expect(Money.fromMinor(1, iso.USD).toString()).toBe("$0.01");
      expect(Money.fromMinor(100, iso.USD).toString()).toBe("$1.00");
      expect(Money.fromMinor(123456, iso.USD).toString()).toBe("$1,234.56");
      expect(Money.fromMinor(123456789, iso.USD).toString()).toBe("$1,234,567.89");
      expect(Money.fromMinor(-100, iso.USD).toString()).toBe("-$1.00");
      expect(Money.fromMinor(-123456, iso.USD).toString()).toBe("-$1,234.56");
    });

    it("formats EUR", () => {
      expect(Money.fromMinor(0, iso.EUR).toString()).toBe("€0,00");
      expect(Money.fromMinor(123456, iso.EUR).toString()).toBe("€1.234,56");
      expect(Money.fromMinor(-123456, iso.EUR).toString()).toBe("-€1.234,56");
    });

    it("formats GBP", () => {
      expect(Money.fromMinor(0, iso.GBP).toString()).toBe("£0.00");
      expect(Money.fromMinor(123456, iso.GBP).toString()).toBe("£1,234.56");
    });

    it("formats JPY", () => {
      expect(Money.fromMinor(0, iso.JPY).toString()).toBe("¥0");
      expect(Money.fromMinor(1, iso.JPY).toString()).toBe("¥1");
      expect(Money.fromMinor(1234, iso.JPY).toString()).toBe("¥1,234");
      expect(Money.fromMinor(1234567, iso.JPY).toString()).toBe("¥1,234,567");
    });

    it("formats INR with the Indian numbering system", () => {
      expect(Money.fromMinor(0, iso.INR).toString()).toBe("₹0.00");
      expect(Money.fromMinor(100, iso.INR).toString()).toBe("₹1.00");
      expect(Money.fromMinor(10000000, iso.INR).toString()).toBe("₹1,00,000.00");
      expect(Money.fromMinor(1000000000, iso.INR).toString()).toBe("₹1,00,00,000.00");
    });

    it("formats BHD with three decimals", () => {
      expect(Money.fromMinor(0, iso.BHD).toString()).toBe("د.ب0.000");
      expect(Money.fromMinor(1, iso.BHD).toString()).toBe("د.ب0.001");
      expect(Money.fromMinor(1000, iso.BHD).toString()).toBe("د.ب1.000");
      expect(Money.fromMinor(1234567, iso.BHD).toString()).toBe("د.ب1,234.567");
    });

    it("formats BYN with the symbol last", () => {
      expect(Money.fromMinor(0, iso.BYN).toString()).toBe("0,00Br");
      expect(Money.fromMinor(123456, iso.BYN).toString()).toBe("1 234,56Br");
      expect(Money.fromMinor(123456789, iso.BYN).toString()).toBe("1 234 567,89Br");
    });
  });

  describe("grouping", () => {
    function grouped(amount: number, separator: string, pattern: readonly number[]): string {
      const money = Money.fromMajor(amount, iso.USD);
      return Formatter.money(
        money,
        params({ digitSeparator: separator, separatorPattern: pattern }),
      );
    }

    it("groups digits with the default pattern", () => {
      expect(grouped(1234567, ",", [3, 3, 3])).toBe("1,234,567");
      expect(grouped(123, ",", [3, 3, 3])).toBe("123");
    });

    it("handles multibyte separators", () => {
      for (const separator of [",", "\u00a0", "\u202f", "💰"]) {
        expect(grouped(1234567, separator, [3, 3, 3])).toBe(`1${separator}234${separator}567`);
        expect(grouped(123456789, separator, [3, 2, 2])).toBe(
          `12${separator}34${separator}56${separator}789`,
        );
        expect(grouped(123, separator, [3, 3, 3])).toBe("123");
      }
    });

    it("groups negative amounts", () => {
      const money = Money.fromMajor(-1234567, iso.USD);
      const formatted = Formatter.money(
        money,
        params({
          digitSeparator: "\u202f",
          symbol: "$",
          rounding: 2,
          separatorPattern: [3, 3, 3],
        }),
      );
      expect(formatted).toBe("-$1\u202f234\u202f567.00");
    });

    it("preserves custom grouping", () => {
      expect(grouped(1234567890, ",", [3, 2, 2])).toBe("123,45,67,890");
      expect(grouped(1234, ",", [])).toBe("1234");
      expect(grouped(1234, ",", [0, 3])).toBe("1,234,");
      expect(grouped(1234, ",", [4, 3])).toBe("1234");
      expect(grouped(1234567, "\u00a0", [3, 3, 3])).toBe("1\u00a0234\u00a0567");
    });

    it("repeats separators for zero width steps", () => {
      expect(grouped(1234567, ",", [0, 0, 3])).toBe("1234,567,,");
    });

    it("stops oversized steps without overflowing", () => {
      expect(grouped(1234567, ",", [Number.MAX_SAFE_INTEGER])).toBe("1234567");
      expect(grouped(1234567, ",", [3, Number.MAX_SAFE_INTEGER, 1])).toBe("1234,567");
      expect(grouped(1234567, ",", [])).toBe("1234567");
    });
  });

  describe("rounding", () => {
    const money = Money.fromMinor(1000, iso.USD).divide(3);

    it("rounds to the requested precision", () => {
      expect(Formatter.money(money, params({ rounding: 0 }))).toBe("3");
      expect(Formatter.money(money, params({ rounding: 2 }))).toBe("3.33");
      expect(Formatter.money(money, params({ rounding: null }))).toBe(
        "3.3333333333333333333333333333",
      );
    });

    it("preserves the carry, the sign and the scale", () => {
      const cases: Array<[string, string]> = [
        ["999.995", "1,000.00"],
        ["-999.995", "-1,000.00"],
        ["-0.001", "-0.00"],
        ["0", "0.00"],
        ["1.5", "1.50"],
      ];

      for (const [input, expected] of cases) {
        const value = Money.fromString(input, iso.USD);
        expect(Formatter.money(value, params({ rounding: 2 }))).toBe(expected);
      }
    });

    it("caps the precision at the decimal maximum", () => {
      const value = Money.fromDecimal(Decimal.fromParts(1n << 64n, 22), iso.USD);

      for (const digits of [28, 29, 31, 32, Number.MAX_SAFE_INTEGER]) {
        expect(Formatter.money(value, params({ rounding: digits }))).toBe(
          "0.0018446744073709551616000000",
        );
      }
    });

    it("does not change the stored amount", () => {
      const value = Money.fromString("999.995", iso.USD);
      Formatter.money(value, params({ rounding: 2 }));
      expect(value.amount.toString()).toBe("999.995");
    });
  });

  describe("positions", () => {
    const money = Money.fromMinor(123450, iso.USD);

    it("places the sign, the symbol and the amount", () => {
      expect(
        Formatter.money(
          money,
          params({
            symbol: "$",
            positions: [Position.Sign, Position.Symbol, Position.Amount],
          }),
        ),
      ).toBe("$1,234.50");
      expect(
        Formatter.money(
          money,
          params({
            symbol: "$",
            positions: [Position.Sign, Position.Amount, Position.Symbol],
          }),
        ),
      ).toBe("1,234.50$");
      expect(
        Formatter.money(
          money,
          params({
            code: "USD",
            positions: [Position.Space, Position.Code, Position.Space, Position.Amount],
          }),
        ),
      ).toBe(" USD 1,234.50");
    });

    it("omits missing parts", () => {
      expect(Formatter.money(money, params())).toBe("1,234.50");
    });
  });

  describe("Money.format", () => {
    it("uses the currency defaults", () => {
      expect(Money.fromMinor(123456, iso.USD).format()).toBe("$1,234.56");
    });

    it("allows overriding single parameters", () => {
      expect(
        Money.fromMinor(123456, iso.USD).format({
          symbol: "€",
          exponentSeparator: ",",
          digitSeparator: ".",
        }),
      ).toBe("€1.234,56");
    });
  });
});
