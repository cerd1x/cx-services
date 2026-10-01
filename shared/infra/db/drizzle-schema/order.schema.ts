import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";

export const orderTable = sqliteTable("order", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "success", "cancelled"] })
    .notNull()
    .default("pending"),
  paymentMethod: text("payment_method", {
    enum: ["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"],
  })
    .notNull()
    .default("cash"),
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  itemCount: integer("item_count").notNull(),
  description: text("description"),
  customerId: integer("customer_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => sql`(unixepoch())`),
});
