/**
 * A TypeScript port of the [`rusty-money`](https://docs.rs/rusty-money/latest/rusty_money/)
 * crate, extended with cryptocurrency support.
 *
 * ```ts
 * import { Money, iso, crypto } from "@lib/money";
 *
 * const price = Money.fromString("1,234.56", iso.USD);
 * price.toString(); // "$1,234.56"
 *
 * const bitcoin = Money.fromMinor(100_000_000n, crypto.BTC);
 * bitcoin.toString(); // "₿1.00000000"
 * ```
 */

export {
  DECIMAL_MAX_COEFFICIENT,
  DECIMAL_MAX_SCALE,
  Decimal,
  DecimalError,
  divEuclid,
  remEuclid,
  type RoundingStrategy,
} from "./src/decimal";

export { isMoneyError, MoneyError, type MoneyErrorKind, type MoneyErrorOptions } from "./src/error";

export { LOCALES, Locale, localFormatFromLocale, type LocalFormat } from "./src/locale";

export {
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
  isoCurrenciesByNumericCode,
  type CryptoCurrencyDefinition,
  type CryptoCurrencySet,
  type Currency,
  type CurrencyKind,
  type IsoCurrencyDefinition,
  type IsoCurrencySet,
} from "./src/currency";

export { Round, roundingStrategyFor } from "./src/round";

export {
  DEFAULT_FORMAT_PARAMS,
  Formatter,
  Position,
  defaultParamsFor,
  type FormatParams,
} from "./src/format";

export { Money } from "./src/money";

export { findSpendableCurrency, formatMoney, isoCodeList, parseMoney } from "./src/literal";

export { Exchange, ExchangeRate } from "./src/exchange";

export { CRYPTO_CURRENCIES } from "./data/crypto";
export { ISO_CURRENCIES } from "./data/iso";
