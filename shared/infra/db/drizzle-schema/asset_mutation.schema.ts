import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { userTable } from "./user.schema";
import { assetTable } from "./asset.schema";

export const assetMutationTable = sqliteTable("asset_mutation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id")
    .notNull()
    .references(() => assetTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["add", "subtract", "transaction", "swap"] }).notNull(),
  /** Nominal mutasi dalam satuan terkecil mata uang (minor unit). */
  amount: integer("amount").notNull(),
  currency: text("currency", { length: 4 }).notNull(),
  /** Saldo sebelum mutasi, dalam satuan terkecil mata uang (minor unit). */
  balanceBefore: integer("balance_before").notNull(),
  /** Saldo sesudah mutasi, dalam satuan terkecil mata uang (minor unit). */
  balanceAfter: integer("balance_after").notNull(),
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
