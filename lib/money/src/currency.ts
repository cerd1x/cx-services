import { ISO_CURRENCIES } from "../data/iso";
import { CRYPTO_CURRENCIES } from "../data/crypto";
import type { Locale } from "./locale";

/** Whether a currency is a fiat currency or a cryptocurrency. */
export type CurrencyKind = "fiat" | "crypto";

/**
 * A currency descriptor.
 *
 * ISO-4217 currencies carry `isoAlphaCode` and `isoNumericCode`; cryptocurrencies
 * only carry a ticker `code`.
 */
export interface Currency {
  /** Ticker of the currency, e.g. `USD` or `BTC`. */
  readonly code: string;
  /** Number of decimal places used when the currency is rendered. */
  readonly exponent: number;
  /** Locale used while formatting the currency. */
  readonly locale: Locale;
  /** Denomination metadata. Amount conversion and formatting use `exponent`. */
  readonly minorUnits: number;
  /** Human readable name. */
  readonly name: string;
  /** Symbol used while formatting the currency. */
  readonly symbol: string;
  /** Whether the symbol is rendered before the amount. */
  readonly symbolFirst: boolean;
  /** Whether this is a fiat currency or a cryptocurrency. */
  readonly kind: CurrencyKind;
  /** Convenience alias for `kind === "crypto"`. */
  readonly isCrypto: boolean;
  /** ISO 4217 alpha code. Only set for fiat currencies. */
  readonly isoAlphaCode?: string;
  /** ISO 4217 numeric code. Only set for fiat currencies. */
  readonly isoNumericCode?: string;
}

/** Shape of the entries in the ISO-4217 table. */
export interface IsoCurrencyDefinition {
  readonly isoAlphaCode: string;
  readonly isoNumericCode: string;
  readonly exponent: number;
  readonly locale: Locale;
  readonly minorUnits: number;
  readonly name: string;
  readonly symbol: string;
  readonly symbolFirst: boolean;
}

/** Shape of the entries in the cryptocurrency table. */
export interface CryptoCurrencyDefinition {
  readonly code: string;
  readonly exponent: number;
  readonly locale: Locale;
  readonly minorUnits: number;
  readonly name: string;
  readonly symbol: string;
  readonly symbolFirst: boolean;
}

function isoCurrency(definition: IsoCurrencyDefinition): Currency {
  return Object.freeze({
    code: definition.isoAlphaCode,
    exponent: definition.exponent,
    locale: definition.locale,
    minorUnits: definition.minorUnits,
    name: definition.name,
    symbol: definition.symbol,
    symbolFirst: definition.symbolFirst,
    kind: "fiat" as const,
    isCrypto: false,
    isoAlphaCode: definition.isoAlphaCode,
    isoNumericCode: definition.isoNumericCode,
  });
}

function cryptoCurrency(definition: CryptoCurrencyDefinition): Currency {
  return Object.freeze({
    code: definition.code,
    exponent: definition.exponent,
    locale: definition.locale,
    minorUnits: definition.minorUnits,
    name: definition.name,
    symbol: definition.symbol,
    symbolFirst: definition.symbolFirst,
    kind: "crypto" as const,
    isCrypto: true,
  });
}

/**
 * Compares two currencies by identity.
 *
 * Mirrors `FormattableCurrency::is_currency_mismatch` from `rusty-money`: every
 * descriptive field takes part in the comparison, so two descriptors that only
 * share a ticker are still considered different currencies.
 */
export function currenciesEqual(left: Currency, right: Currency): boolean {
  return (
    left.code === right.code &&
    left.exponent === right.exponent &&
    left.locale === right.locale &&
    left.minorUnits === right.minorUnits &&
    left.name === right.name &&
    left.symbol === right.symbol &&
    left.symbolFirst === right.symbolFirst &&
    left.kind === right.kind &&
    left.isoAlphaCode === right.isoAlphaCode &&
    left.isoNumericCode === right.isoNumericCode
  );
}

/** Whether two currencies have different identities. */
export function isCurrencyMismatch(left: Currency, right: Currency): boolean {
  return !currenciesEqual(left, right);
}

/** All ISO-4217 currencies, keyed by alpha code. */
export const isoCurrencies: Readonly<Record<string, Currency>> = Object.freeze(
  Object.fromEntries(
    ISO_CURRENCIES.map((definition) => [definition.isoAlphaCode, isoCurrency(definition)]),
  ),
);

/** All ISO-4217 currencies, keyed by numeric code. */
export const isoCurrenciesByNumericCode: Readonly<Record<string, Currency>> = Object.freeze(
  Object.fromEntries(
    ISO_CURRENCIES.map((definition) => [definition.isoNumericCode, isoCurrency(definition)]),
  ),
);

/** All cryptocurrencies, keyed by ticker. */
export const cryptoCurrencies: Readonly<Record<string, Currency>> = Object.freeze(
  Object.fromEntries(
    CRYPTO_CURRENCIES.map((definition) => [definition.code, cryptoCurrency(definition)]),
  ),
);

/** Looks up a fiat currency by its ISO 4217 alpha code. */
export function findIsoCurrency(code: string): Currency | undefined {
  return isoCurrencies[code];
}

/** Looks up a fiat currency by its ISO 4217 numeric code. */
export function findIsoCurrencyByNumericCode(code: string): Currency | undefined {
  return isoCurrenciesByNumericCode[code];
}

/** Looks up a cryptocurrency by its ticker. */
export function findCryptoCurrency(code: string): Currency | undefined {
  return cryptoCurrencies[code];
}

/**
 * Looks up any currency by its code.
 *
 * Fiat currencies take precedence over cryptocurrencies when both share a code.
 */
export function findCurrency(code: string): Currency | undefined {
  return isoCurrencies[code] ?? cryptoCurrencies[code];
}

/** The ISO-4217 currency set. */
export type IsoCurrencySet = Readonly<Record<string, Currency>> & {
  /** Looks up a currency by its ISO 4217 alpha code. */
  find(code: string): Currency | undefined;
  /** Looks up a currency by its ISO 4217 numeric code. */
  findByNumCode(code: string): Currency | undefined;
};

/** The cryptocurrency set. */
export type CryptoCurrencySet = Readonly<Record<string, Currency>> & {
  /** Looks up a cryptocurrency by its ticker. */
  find(code: string): Currency | undefined;
};

/**
 * The ISO-4217 currency set.
 *
 * The currencies are exposed as own properties (`iso.USD`) and can be looked
 * up with {@link IsoCurrencySet.find}.
 */
export const iso: IsoCurrencySet = Object.freeze(
  Object.assign(
    { find: findIsoCurrency, findByNumCode: findIsoCurrencyByNumericCode },
    isoCurrencies,
  ),
);

/**
 * The cryptocurrency set.
 *
 * The currencies are exposed as own properties (`crypto.BTC`) and can be looked
 * up with {@link CryptoCurrencySet.find}.
 */
export const crypto: CryptoCurrencySet = Object.freeze(
  Object.assign({ find: findCryptoCurrency }, cryptoCurrencies),
);

/**
 * Builds a custom cryptocurrency descriptor.
 *
 * Mirrors `rusty_money::define_currency_set!`, which allows projects to define
 * their own currency sets.
 */
export function defineCryptoCurrency(definition: CryptoCurrencyDefinition): Currency {
  return cryptoCurrency(definition);
}

/**
 * Builds a custom fiat currency descriptor.
 *
 * Mirrors `rusty_money::define_currency_set!`, which allows projects to define
 * their own currency sets.
 */
export function defineFiatCurrency(definition: IsoCurrencyDefinition): Currency {
  return isoCurrency(definition);
}
