import { Money, Round, findCurrency } from "@lib/money";

/**
 * Representasi nilai uang di database (SQLite/D1).
 *
 * Aturan penyimpanannya:
 *
 * - **Tabel yang punya kolom `currency`** (mis. `asset`, `asset_mutation`):
 *   nominal disimpan sebagai **minor unit** — satuan terkecil mata uang —
 *   di kolom `INTEGER`, jadi presisi penuh tanpa floating point. Kode mata
 *   uangnya tetap dibaca dari kolom `currency`.
 * - **Tabel tanpa kolom `currency`** (mis. `transaction`): instance `Money`
 *   diserialisasi penuh sebagai JSON `{"amount":"1500000","currency":"IDR"}`
 *   di kolom `TEXT` (hasil `JSON.stringify(money)`).
 *
 * Dengan begitu nilai yang tersimpan selalu bisa dipulihkan jadi instance
 * `Money` tanpa perlu menebak format teksnya.
 */

/** Instance `Money` -> minor unit (satuan terkecil) untuk kolom INTEGER. */
export function toMinorUnits(money: Money): bigint {
  return money.round(money.currency.exponent, Round.HalfUp).toMinorUnits();
}

/**
 * Minor unit + kode mata uang -> instance `Money`.
 *
 * @throws {Error} Kalau kode mata uangnya tidak dikenal.
 */
export function fromMinorUnits(minor: bigint | number, currencyCode: string): Money {
  const currency = findCurrency(currencyCode);
  if (!currency) {
    throw new Error(`Unknown currency: ${currencyCode}`);
  }
  const value = typeof minor === "bigint" ? minor : BigInt(Math.trunc(minor));
  return Money.fromMinor(value, currency);
}

/** Instance `Money` -> JSON untuk kolom TEXT. */
export function serializeMoney(money: Money): string {
  return JSON.stringify(money);
}

/**
 * JSON di kolom TEXT -> instance `Money`.
 *
 * @throws {Error} Kalau isi kolomnya bukan JSON instance `Money`.
 */
export function deserializeMoney(raw: string): Money {
  return Money.fromJSON(JSON.parse(raw) as { amount: string; currency: string });
}
