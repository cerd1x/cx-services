# `@lib/money`

A TypeScript port of the [`rusty-money`](https://docs.rs/rusty-money/latest/rusty_money/)
crate (v0.5.1) with added cryptocurrency support.

The library keeps the semantics of the original crate: fixed-point decimals, the
same ISO-4217 table, the same locales, the same rounding strategies and the
same formatting output. Where the Rust API returns a `Result`, the TypeScript
API throws a typed `MoneyError`.

```ts
import { Money, iso, crypto } from "@lib/money";

const price = Money.fromString("1,234.56", iso.USD);
price.toString(); // "$1,234.56"
price.toMinorUnits(); // 123456n

const bitcoin = Money.fromMinor(100_000_000n, crypto.BTC);
bitcoin.toString(); // "₿1.00000000"
```

## Contents

- [Amounts](#amounts)
- [Currencies](#currencies)
- [Money in services](#money-in-services)
- [Formatting](#formatting)
- [Arithmetic](#arithmetic)
- [Rounding](#rounding)
- [Splitting and allocating](#splitting-and-allocating)
- [Exchange rates](#exchange-rates)
- [Errors](#errors)
- [Cryptocurrencies](#cryptocurrencies)
- [Differences from the Rust crate](#differences-from-the-rust-crate)
- [Tests](#tests)

## Amounts

`Money` is immutable. Every operation returns a new value, and the stored
amount keeps its scale: `1.50` stays `1.50` and is never silently rewritten to
`1.5`.

```ts
const amount = Money.fromString("12.3400", iso.USD);

amount.amount.toString(); // "12.3400"
amount.amount.scale; // 4
amount.amount.coefficient; // 123400n
```

The amount is stored as a `Decimal`, a port of the [`rust_decimal`]
(https://docs.rs/rust_decimal/latest/rust_decimal/) crate: a 96-bit signed
coefficient plus a scale in `0..=28`. All arithmetic runs on `bigint`, so no
intermediate value is ever rounded through a binary float.

| Rust                         | TypeScript                                     |
| ---------------------------- | ---------------------------------------------- |
| `Money::from_str`            | `Money.fromString` (alias `Money.fromStr`)     |
| `Money::from_minor`          | `Money.fromMinor` (alias `Money.tryFromMinor`) |
| `Money::from_major`          | `Money.fromMajor`                              |
| `Money::from_decimal`        | `Money.fromDecimal`                            |
| `money.amount()`             | `money.amount`                                 |
| `money.currency()`           | `money.currency`                               |
| `money.to_minor_units()`     | `money.toMinorUnits()`                         |
| `money.try_to_minor_units()` | `money.tryToMinorUnits()`                      |
| `money.to_f64_lossy()`       | `money.toNumber()`                             |
| `money.abs()`                | `money.abs()`                                  |
| `-money`                     | `money.negate()`                               |
| `money.is_zero()`            | `money.isZero()`                               |
| `money.is_positive()`        | `money.isPositive()`                           |
| `money.is_negative()`        | `money.isNegative()`                           |

`fromString` accepts the grouped and ungrouped forms of the currency's locale:
`"1,234.56"` for `EnUs`, `"1.234,56"` for `EnEu`, `"1 234,56"` for `EnBy` and
`"1,23,456.78"` for `EnIn`. Underscores are accepted as digit separators.

## Currencies

The ISO-4217 table ships with the library. Lookups are case sensitive, exactly
like in the Rust crate.

```ts
iso.USD.exponent; // 2
iso.find("EUR"); // the Euro descriptor
iso.findByNumCode("978"); // the Euro descriptor
```

Cryptocurrencies live in a separate set, so a ticker never shadows a fiat
currency:

```ts
crypto.BTC.exponent; // 8
crypto.find("ETH"); // the Ethereum descriptor
```

Every descriptor exposes `code`, `exponent`, `locale`, `minorUnits`, `name`,
`symbol`, `symbolFirst`, `kind` (`"fiat"` or `"crypto"`) and `isCrypto`.
ISO descriptors additionally carry `isoAlphaCode` and `isoNumericCode`.

Custom currencies are created with `defineFiatCurrency` and
`defineCryptoCurrency`, which replace the `define_currency_set!` macro of the
Rust crate.

```ts
const points = defineCryptoCurrency({
  code: "PTS",
  exponent: 2,
  locale: "EnUs",
  minorUnits: 100,
  name: "Loyalty Points",
  symbol: "pts",
  symbolFirst: false,
});
```

## Money in services

The library does **not** ship a string codec. Inside the domain, money is always
a `Money` instance; string / database conversions live at the boundaries of the
consuming service:

- **GraphQL** — the custom scalar `Money` in
  `shared/infra/graphql/scalars/money.ts` parses and serializes the wire format
  `"KODE NOMINAL"` (e.g. `"IDR 1500000"`, `"USD 100.5"`). It accepts only
  spendable ISO-4217 codes (`XXX`, `XDR`, `XBA`..`XBD`, `XSU`, `XTS`, `XUA`, `XAD`
  are rejected) and rounds the amount to the currency exponent with `Round.HalfUp`.
- **Database** — `shared/infra/db/money.ts`:
  - `toMinorUnits(money)` / `fromMinorUnits(value, code)` for tables that have a
    `currency` column; values are stored as integer **minor units** (satuan
    terkecil), so `IDR 1500000` is stored as `150000000` (IDR exponent is 2).
  - `serializeMoney(money)` / `deserializeMoney(text)` for tables without a
    `currency` column; values are stored as JSON:
    `{"amount":"1500000.00","currency":"IDR"}`.

```ts
import { Money, iso } from "@lib/money";
import { toMinorUnits, fromMinorUnits } from "$services/shared/infra/db/money";

toMinorUnits(Money.fromNumber(1500000, iso.IDR)); // 150000000n
fromMinorUnits(150000000, "IDR").toNumber(); // 1500000
```

## Formatting

`toString()` mirrors the `Display` implementation of the Rust crate: the
amount is rounded to the currency's exponent with `HalfEven`, the digits are
grouped with the locale's pattern, and the symbol is placed before or after the
amount depending on `symbolFirst`.

```ts
Money.fromMinor(123456, iso.USD).toString(); // "$1,234.56"
Money.fromMinor(123456, iso.EUR).toString(); // "€1.234,56"
Money.fromMinor(10000000, iso.INR).toString(); // "₹1,00,000.00"
Money.fromMinor(123456, iso.BYN).toString(); // "1 234,56Br"
```

`format()` overrides single parameters, and `Formatter.money` gives full
control over the output.

```ts
Money.fromMinor(123456, iso.USD).format({ symbol: "€" }); // "€1,234.56"

Formatter.money(money, {
  ...DEFAULT_FORMAT_PARAMS,
  positions: [Position.Sign, Position.Amount, Position.Symbol],
  rounding: 2,
});
```

## Arithmetic

`add` and `subtract` require the same currency, `multiply` and `divide` accept
a scalar.

```ts
const a = Money.fromMinor(1000, iso.USD);
const b = Money.fromMinor(250, iso.USD);

a.add(b).toMinorUnits(); // 1250n
a.subtract(b).toMinorUnits(); // 750n
a.multiply(1.5).toMinorUnits(); // 1500n
a.divide(2).toMinorUnits(); // 500n
```

The Rust names are available as aliases: `sub`, `mul` and `div`.

## Rounding

`round` never changes the stored amount; it returns a new value.

```ts
const value = Money.fromString("-1.005", iso.USD);

value.round(2, Round.HalfUp).amount.toString(); // "-1.01"
value.round(2, Round.HalfDown).amount.toString(); // "-1.00"
value.round(2, Round.HalfEven).amount.toString(); // "-1.00"
```

The strategies are the same as in the Rust crate: `HalfUp` (midpoints away
from zero), `HalfDown` (midpoints toward zero) and `HalfEven` (midpoints to an
even digit).

## Splitting and allocating

`split` divides an amount into `n` equal shares, `allocate` divides it
according to weights. Both floor to integral minor units towards negative
infinity, so the total is never changed.

```ts
Money.fromMinor(1000, iso.USD).split(3); // $3.34, $3.33, $3.33
Money.fromMinor(1000, iso.USD).allocate([70, 20, 10]); // $7.00, $2.00, $1.00
```

## Exchange rates

```ts
const exchange = new Exchange([new ExchangeRate(iso.USD, iso.EUR, Decimal.fromString("0.85")!)]);

Money.fromMinor(1000, iso.USD).exchangeTo(iso.EUR, exchange); // €8.50
```

Rates are keyed by the currency pair, so a rate is never applied in the wrong
direction.

## Errors

The Rust `Result` becomes a thrown `MoneyError`. The variant is available as
the `kind` discriminant.

```ts
import { isMoneyError, MoneyError } from "@lib/money";

try {
  Money.fromString("not a number", iso.USD);
} catch (error) {
  if (isMoneyError(error)) {
    error.kind; // "InvalidAmount"
  }
}
```

| Rust variant       | `MoneyError.kind`  |
| ------------------ | ------------------ |
| `InvalidCurrency`  | `InvalidCurrency`  |
| `InvalidAmount`    | `InvalidAmount`    |
| `InvalidRatio`     | `InvalidRatio`     |
| `CurrencyMismatch` | `CurrencyMismatch` |
| `DivisionByZero`   | `DivisionByZero`   |
| `Overflow`         | `Overflow`         |
| `PrecisionLoss`    | `PrecisionLoss`    |

`CurrencyMismatch` additionally carries the `expected` and `actual` currency
codes.

## Cryptocurrencies

The fourteen currencies of the original crate (`BTC`, `COMP`, `DAI`, `ETH`,
`LTC`, `MKR`, `TRX`, `UNI`, `USDC`, `USDT`, `XTZ`, `ZEC`, `BCH`, `BSV`) keep
their exact exponents, symbols and locales. The library adds a set of widely
traded layer-1 coins, stablecoins and DeFi tokens on top of them.

Cryptocurrencies are ordinary currencies, so every operation works unchanged:

```ts
const eth = Money.fromMinor(1_000_000_000_000_000_000n, crypto.ETH);

eth.toString(); // "1.000000000000000000ETH"
eth.toMinorUnits(); // 1000000000000000000n
```

Because the minor units are `bigint` instead of `i64`, amounts with 18 decimal
places never overflow.

## Differences from the Rust crate

- **Errors are thrown.** The Rust API returns `Result<_, MoneyError>`; the
  TypeScript API throws a `MoneyError` and offers `isMoneyError` as a type
  guard.
- **Minor units are `bigint`.** The Rust crate stores them in an `i64` and
  reports an overflow beyond that range. The TypeScript port uses `bigint`, so
  `toMinorUnits` never overflows, and `tryToMinorUnits` only reports
  `PrecisionLoss`.
- **Custom currencies are values, not types.** The Rust crate generates a
  currency set with a macro, so each currency is a distinct type. The
  TypeScript port uses plain objects, and `currenciesEqual` compares every
  descriptive field.
- **The crypto table is larger.** The Rust crate ships fourteen
  cryptocurrencies, the port ships those plus an extension set.
- **`Decimal` is exported.** The Rust crate hides `rust_decimal` behind
  `Money::amount()`. The port exports the `Decimal` class so amounts can be
  inspected and built without going through `Money`.

## Tests

```sh
bun test --preload ./tests/setup.ts tests/lib/money
```

The suite ports the behavioural tests of the Rust crate one-to-one, including
the golden formatting values.
