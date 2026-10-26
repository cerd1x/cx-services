import { sqliteTable, text, integer, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { userTable } from "./user.schema";
import { assetTable } from "./asset.schema";

/** Nilai `asset_mutation.type` yang sah. Dipakai juga oleh CHECK constraint. */
export const ASSET_MUTATION_TYPES = ["add", "subtract", "transaction", "swap"] as const;

export const assetMutationTable = sqliteTable(
  "asset_mutation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assetTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    type: text("type", { enum: ASSET_MUTATION_TYPES }).notNull(),
    /** Nominal mutasi dalam satuan terkecil mata uang (minor unit). */
    amount: integer("amount").notNull(),
    currency: text("currency", { length: 4 }).notNull(),
    /** Saldo sebelum mutasi, dalam satuan terkecil mata uang (minor unit). */
    balanceBefore: integer("balance_before").notNull(),
    /** Saldo sesudah mutasi, dalam satuan terkecil mata uang (minor unit). */
    balanceAfter: integer("balance_after").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  // Sama seperti `asset`: CHECK eksplisit supaya ikut ke migrasi.
  (table) => [
    check(
      "asset_mutation_type_check",
      sql`${table.type} in ('add', 'subtract', 'transaction', 'swap')`,
    ),
  ],
);
