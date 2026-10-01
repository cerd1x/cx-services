import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
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
  amount: real("amount").notNull(),
  currency: text("currency", { length: 4 }).notNull(),
  balanceBefore: text("balance_before").notNull(),
  balanceAfter: text("balance_after").notNull(),
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
