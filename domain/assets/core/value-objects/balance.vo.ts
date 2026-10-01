import { add, dinero, subtract, type Dinero } from "dinero.js";
import * as _Currencies from "dinero.js/currencies";
import z from "zod";
import type { CurrencyType } from "../model/asset.model";

export const isoCodeList = Object.entries(_Currencies).map((value, _) => value[1].code);

const isoCodeSchema = z.enum(isoCodeList);

const currencyLocaleMap: Record<string, string> = {
  IDR: "id-ID",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  SGD: "en-SG",
  MYR: "ms-MY",
  CNY: "zh-CN",
  KRW: "ko-KR",
  AUD: "en-AU",
  CAD: "en-CA",
  CHF: "de-CH",
  THB: "th-TH",
  PHP: "en-PH",
  VND: "vi-VN",
};

export function currencyToLocale(code: string): string {
  return currencyLocaleMap[code] ?? "en-US";
}

export type IsoCodeType = z.infer<typeof isoCodeSchema>;
export type CurrencyMetaType = (typeof _Currencies)[keyof typeof _Currencies];

export class Balance {
  #value!: Dinero<number, IsoCodeType>;

  static getSymbol(isoCode: string) {
    return (0)
      .toLocaleString("en", {
        style: "currency",
        currency: isoCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/\d/g, "")
      .trim();
  }

  constructor() {}

  /**
   * value is number decimal of money
   * exclude ISO CODE
   */
  get value(): number {
    const { amount, scale } = this.#value.toJSON();
    return amount / Math.pow(10, scale);
  }

  /**
   * Convert balance to another currency using exchange rate.
   * The rate is the multiplier to convert the current amount to the target currency.
   * Example: Balance("USD 100").convertTo(Currencies.EUR, 0.92) → EUR 92
   */
  convertTo(targetCurrency: CurrencyType, exchangeRate: number): Balance {
    const b = new Balance();
    const { amount: srcAmount, scale: srcScale } = this.#value.toJSON();
    const targetExponent = targetCurrency.exponent;
    const targetScale = Math.pow(10, targetExponent);
    const srcScaleFactor = Math.pow(10, srcScale);
    const convertedAmount = Math.round((srcAmount * exchangeRate * targetScale) / srcScaleFactor);
    b.#value = dinero({ amount: convertedAmount, currency: targetCurrency, scale: targetExponent });
    return b;
  }

  get code(): IsoCodeType {
    return this.#value.toJSON().currency.code;
  }

  /** Format balance to localized currency string (e.g. "Rp 100,00"). */
  get toLocalStr(): string {
    return this.value.toLocaleString(currencyToLocale(this.code), {
      style: "currency",
      currency: this.code,
    });
  }

  /** Create a zero-balance instance. Defaults to IDR. */
  static zero(currency: string = "IDR"): Balance {
    const b = new Balance();
    const curr = _Currencies[currency as keyof typeof _Currencies];
    b.#value = dinero({ amount: 0, currency: curr, scale: curr.exponent });
    return b;
  }

  /// supports ISO CODE + Value with String
  /// Format: "USD 100" or "USD 100.50"
  static new(value: string): Balance {
    const b = new Balance();

    const match = value.trim().match(/^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/);
    if (!match) {
      throw new Error(
        `Invalid balance format: "${value}". Expected "ISO_CODE VALUE" (e.g. "USD 100")`,
      );
    }

    const [, isoCode, rawAmount] = match;

    if (!(isoCode in _Currencies)) {
      throw new Error(`Currency must be a 3-letter code: ${isoCode}`);
    }

    const amount = parseFloat(rawAmount.replace(/,/g, ""));

    const currency = _Currencies[isoCode as keyof typeof _Currencies];
    const minorAmount = Math.round(amount * Math.pow(10, currency.exponent));
    b.#value = dinero({ amount: minorAmount, currency, scale: currency.exponent });

    return b;
  }

  subtract(value: Balance) {
    this.#value = subtract(this.#value, value.#value);
  }

  add(value: Balance) {
    this.#value = add(this.#value, value.#value);
  }

  static is(value: unknown): value is Balance | string {
    if (value instanceof Balance) return true;
    if (typeof value === "string") {
      const match = value.trim().match(/^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/);
      if (match && match[1] in _Currencies) return true;
    }
    return false;
  }

  toString() {
    return `${this.code} ${this.value}`;
  }
}

export const zBalanceScema = z.instanceof(Balance).refine(
  (value) => {
    return Balance.is(value);
  },
  { error: "nilai ini bukan dari instanceOf Balance" },
);

export { _Currencies as Currencies };
