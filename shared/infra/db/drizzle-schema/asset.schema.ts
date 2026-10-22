import { sqliteTable, text, integer, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { userTable } from "./user.schema";

/** Nilai `asset.type` yang sah. Dipakai juga oleh CHECK constraint di database. */
export const ASSET_TYPES = ["bank", "ewallet", "cash", "loan", "crypto"] as const;

export const assetTable = sqliteTable(
  "asset",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ASSET_TYPES }).notNull(),
    /** Saldo dalam satuan terkecil mata uang (minor unit), bukan major unit. */
    balance: integer("balance").notNull().default(0),
    currency: text("currency", { length: 4 }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  // Drizzle-kit tidak menurunkan CHECK dari `enum`, jadi invariant enum ditulis
  // eksplisit agar ikut ke migrasi (dan tidak hilang saat tabel di-recreate).
  (table) => [
    check("asset_type_check", sql`${table.type} in ('bank', 'ewallet', 'cash', 'loan', 'crypto')`),
  ],
);
