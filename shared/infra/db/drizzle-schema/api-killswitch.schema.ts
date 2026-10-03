import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Kill switch per GraphQL operation.
 *
 * Semantic: **baris ada = operation dimatikan**. Menghapus baris menghidupkan
 * kembali. Konsekuensinya state default saat tabel kosong adalah "semua aktif",
 * yang persis yang diinginkan — sistem yang gagal reading (D1 down, tabel belum
 * termigrasi) tetap melayani traffic, bukan mati total.
 *
 * `operation` memakai bentuk `"<Type>.<field>"`, mis. `"Mutation.createTransaction"`.
 */
export const apiKillswitchTable = sqliteTable(
  "api_killswitch",
  {
    operation: text("operation").primaryKey(),
    reason: text("reason"),
    disabledAt: integer("disabled_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => sql`(unixepoch())`),
  },
  (t) => [
    // Mendukung `ORDER BY disabled_at DESC` pada daftar switch yang aktif,
    // supaya switch terbaru (paling mungkin wanted) tampil di atas.
    index("api_killswitch_disabled_at_idx").on(t.disabledAt),
  ],
);