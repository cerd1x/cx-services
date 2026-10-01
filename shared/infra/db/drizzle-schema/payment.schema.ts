import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";
import { invoiceTable } from "./invoice.schema";

export const paymentTable = sqliteTable("payment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id").references(() => invoiceTable.id, { onDelete: "set null" }),
  amount: real("amount").notNull(),
  currency: text("currency", { length: 3 }).notNull(),
  method: text("method", {
    enum: ["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed", "refunded", "cancelled"],
  })
    .notNull()
    .default("pending"),
  gatewayRef: text("gateway_ref"),
  description: text("description"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => sql`(unixepoch())`),
});
