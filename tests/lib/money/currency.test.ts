import { describe, expect, it } from "bun:test";
import {
  CRYPTO_CURRENCIES,
  ISO_CURRENCIES,
  crypto,
  cryptoCurrencies,
  currenciesEqual,
  defineCryptoCurrency,
  defineFiatCurrency,
  findCryptoCurrency,
  findCurrency,
  findIsoCurrency,
  findIsoCurrencyByNumericCode,
  isCurrencyMismatch,
  iso,
  isoCurrencies,
} from "@lib/money";

describe("ISO currencies", () => {
  it("contains the full ISO-4217 table", () => {
    expect(ISO_CURRENCIES).toHaveLength(189);
    expect(Object.keys(isoCurrencies)).toHaveLength(189);
  });

  it("looks up a currency by its alpha code", () => {
    expect(findIsoCurrency("USD")?.name).toBe("United States Dollar");
    expect(findIsoCurrency("EUR")?.exponent).toBe(2);
    expect(findIsoCurrency("JPY")?.exponent).toBe(0);
    expect(findIsoCurrency("BHD")?.exponent).toBe(3);
    expect(findIsoCurrency("KWD")?.exponent).toBe(3);
  });

  it("looks up a currency by its numeric code", () => {
    expect(findIsoCurrencyByNumericCode("840")?.code).toBe("USD");
    expect(findIsoCurrencyByNumericCode("978")?.code).toBe("EUR");
    expect(findIsoCurrencyByNumericCode("392")?.code).toBe("JPY");
    expect(findIsoCurrencyByNumericCode("999")?.code).toBe("XXX");
    expect(findIsoCurrencyByNumericCode("0000")).toBeUndefined();
  });

  it("exposes the currencies as a keyed set", () => {
    expect(iso.USD.code).toBe("USD");
    expect(iso.EUR.symbol).toBe("€");
    expect(iso.find("GBP")?.symbol).toBe("£");
    expect(iso.findByNumCode("356")?.code).toBe("INR");
  });

  it("does not match an unknown or lower case code", () => {
    expect(findIsoCurrency("XYZ")).toBeUndefined();
    expect(findIsoCurrency("usd")).toBeUndefined();
  });

  it("marks every entry as fiat", () => {
    for (const currency of Object.values(isoCurrencies)) {
      expect(currency.kind).toBe("fiat");
      expect(currency.isCrypto).toBe(false);
      expect(currency.isoAlphaCode).toBe(currency.code);
    }
  });
});

describe("cryptocurrencies", () => {
  it("contains the currencies shipped by rusty-money", () => {
    for (const code of [
      "BTC",
      "COMP",
      "DAI",
      "ETH",
      "LTC",
      "MKR",
      "TRX",
      "UNI",
      "USDC",
      "USDT",
      "XTZ",
      "ZEC",
      "BCH",
      "BSV",
    ]) {
      expect(findCryptoCurrency(code)).toBeDefined();
    }
  });

  it("uses the exponents of the original crate", () => {
    expect(crypto.BTC.exponent).toBe(8);
    expect(crypto.ETH.exponent).toBe(18);
    expect(crypto.LTC.exponent).toBe(8);
    expect(crypto.TRX.exponent).toBe(6);
    expect(crypto.USDT.exponent).toBe(6);
    expect(crypto.XTZ.exponent).toBe(6);
  });

  it("keeps the minor units consistent with the exponent", () => {
    for (const definition of CRYPTO_CURRENCIES) {
      expect(definition.minorUnits).toBe(10 ** definition.exponent);
    }
  });

  it("looks up a currency by its ticker", () => {
    expect(findCryptoCurrency("BTC")?.name).toBe("Bitcoin");
    expect(findCryptoCurrency("btc")).toBeUndefined();
    expect(crypto.find("ETH")?.exponent).toBe(18);
  });

  it("marks every entry as crypto", () => {
    for (const currency of Object.values(cryptoCurrencies)) {
      expect(currency.kind).toBe("crypto");
      expect(currency.isCrypto).toBe(true);
      expect(currency.isoAlphaCode).toBeUndefined();
      expect(currency.isoNumericCode).toBeUndefined();
    }
  });
});

describe("findCurrency", () => {
  it("finds fiat and crypto currencies", () => {
    expect(findCurrency("USD")?.kind).toBe("fiat");
    expect(findCurrency("BTC")?.kind).toBe("crypto");
    expect(findCurrency("NOPE")).toBeUndefined();
  });
});

describe("currency identity", () => {
  it("compares every descriptive field", () => {
    expect(currenciesEqual(iso.USD, iso.USD)).toBe(true);
    expect(currenciesEqual(iso.USD, iso.EUR)).toBe(false);
    expect(isCurrencyMismatch(iso.USD, iso.EUR)).toBe(true);
    expect(isCurrencyMismatch(iso.USD, iso.USD)).toBe(false);
  });

  it("treats a custom currency with the same fields as equal", () => {
    const custom = defineFiatCurrency({
      isoAlphaCode: "USD",
      isoNumericCode: "840",
      exponent: 2,
      locale: "EnUs",
      minorUnits: 1,
      name: "United States Dollar",
      symbol: "$",
      symbolFirst: true,
    });

    expect(currenciesEqual(custom, iso.USD)).toBe(true);
  });
});

describe("custom currencies", () => {
  it("defines a fiat currency", () => {
    const custom = defineFiatCurrency({
      isoAlphaCode: "XTS",
      isoNumericCode: "963",
      exponent: 2,
      locale: "EnUs",
      minorUnits: 1,
      name: "Test Currency",
      symbol: "T",
      symbolFirst: true,
    });

    expect(custom.kind).toBe("fiat");
    expect(custom.code).toBe("XTS");
  });

  it("defines a crypto currency", () => {
    const custom = defineCryptoCurrency({
      code: "TEST",
      exponent: 8,
      locale: "EnUs",
      minorUnits: 100_000_000,
      name: "Test Coin",
      symbol: "T",
      symbolFirst: false,
    });

    expect(custom.kind).toBe("crypto");
    expect(custom.isCrypto).toBe(true);
    expect(custom.code).toBe("TEST");
  });
});
