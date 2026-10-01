import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";

export const transactionTable = sqliteTable("transaction", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["income", "expense", "transfer", "outcome"] }).notNull(),
  status: text("status", { enum: ["pending", "success", "failed"] })
    .notNull()
    .default("pending"),
  paymentMethod: text("payment_method").notNull().default('{"type":"cash"}'),
  customerId: integer("customer_id"),
  amount: text("amount").notNull(),
  capital: text("capital").notNull(),
  description: text("description"),
  category: text("category"),
  date: text("date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => sql`(unixepoch())`),
}, (t) => [
  // Supports the keyset predicate used by TransactionRepositoryImpl.findPage:
  // WHERE user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?))
  // ORDER BY created_at DESC, id DESC LIMIT ?
  index("transaction_user_id_created_at_id_idx").on(t.userId, t.createdAt, t.id),
]);
