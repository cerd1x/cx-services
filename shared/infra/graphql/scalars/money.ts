import { GraphQLScalarType, Kind, type ValueNode } from "graphql";
import { Decimal, Money, Round, findIsoCurrency } from "@lib/money";

/**
 * Kode ISO 4217 yang tidak boleh dipakai sebagai saldo.
 *
 * `XXX` berarti "tanpa mata uang", sedangkan kode `XBA`..`XBD`, `XDR`, `XSU`,
 * `XTS`, `XUA` dan `XAD` adalah unit akun / kode uji, bukan mata uang yang
 * bisa dibelanjakan.
 */
const NON_SPENDABLE_ISO_CODES: ReadonlySet<string> = new Set([
  "XAD",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);

/** Format nominal uang di wire: "KODE_ISO NOMINAL", mis. "IDR 1500000". */
const MONEY_PATTERN = /^([A-Z]{3})\s+(-?[\d,]+(?:\.\d+)?)$/;

/**
 * Parse "KODE_ISO NOMINAL" jadi instance {@link Money}.
 *
 * Titik desimal selalu dibaca sebagai desimal (bukan pemisah ribuan), dan
 * nominal dibulatkan ke satuan terkecil mata uang dengan {@link Round.HalfUp}.
 *
 * @throws {TypeError} Kalau formatnya salah atau kodenya bukan mata uang yang
 * bisa dibelanjakan.
 */
export function parseMoneyValue(value: string): Money {
  const match = value.trim().match(MONEY_PATTERN);
  if (!match) {
    throw new TypeError(
      `Invalid money format: "${value}". Expected "ISO_CODE VALUE" (e.g. "IDR 1500000")`,
    );
  }

  const [, code, rawAmount] = match;
  // Hanya kode ISO 4217 yang bisa dibelanjakan: ticker kripto tidak memakai
  // format "KODE NOMINAL" ini.
  const currency = findIsoCurrency(code);
  if (!currency || NON_SPENDABLE_ISO_CODES.has(code)) {
    throw new TypeError(`Currency must be a 3-letter code: ${code}`);
  }

  const decimal = Decimal.fromString(rawAmount.replace(/,/g, ""));
  if (!decimal) {
    throw new TypeError(`Invalid money amount: "${rawAmount}"`);
  }

  // Kanonikkan ke skala mata uangnya, supaya instance `Money` dari wire selalu
  // punya bentuk yang sama dengan yang dibaca kembali dari database.
  const rounded = Money.fromDecimal(decimal, currency).round(currency.exponent, Round.HalfUp);
  return Money.fromMinor(rounded.toMinorUnits(), currency);
}

/**
 * Format instance {@link Money} jadi "KODE_ISO NOMINAL", mis. "IDR 1500000".
 */
export function serializeMoneyValue(money: Money): string {
  return `${money.currency.code} ${money.toNumber()}`;
}

/**
 * Scalar GraphQL untuk nilai uang.
 *
 * Di wire tetap berupa string "KODE_ISO NOMINAL" supaya client tidak perlu
 * tahu bentuk internal `Money`. Di dalam resolver, nilainya sudah instance
 * `Money` — parser scalar yang mengubah string jadi instance.
 */
export const MoneyResolver = new GraphQLScalarType({
  name: "Money",
  description:
    'Nominal uang berformat "KODE_ISO NOMINAL", contoh: "IDR 1500000" atau "USD 100.50".',

  serialize(value: unknown): string {
    if (value instanceof Money) return serializeMoneyValue(value);
    throw new TypeError(`Money: cannot serialize value: ${String(value)}`);
  },

  parseValue(value: unknown): Money {
    if (typeof value === "string") return parseMoneyValue(value);
    throw new TypeError(`Money: expected string, got ${typeof value}`);
  },

  parseLiteral(ast: ValueNode, _variables: Record<string, unknown> | null | undefined): Money {
    if (ast.kind === Kind.STRING) return parseMoneyValue(ast.value);
    throw new TypeError("Money: expected String literal");
  },
});
