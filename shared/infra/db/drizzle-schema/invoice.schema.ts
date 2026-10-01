import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";
import { contactTable } from "./contact.schema";

export const invoiceTable = sqliteTable("invoice", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => contactTable.id, { onDelete: "set null" }),
  items: text("items").notNull(),
  subtotal: real("subtotal").notNull(),
  tax: real("tax").notNull().default(0),
  totalAmount: real("total_amount").notNull(),
  currency: text("currency", { length: 3 }).notNull(),
  status: text("status", {
    enum: ["draft", "issued", "paid", "partially_paid", "overdue", "cancelled"],
  })
    .notNull()
    .default("draft"),
  issuedAt: integer("issued_at", { mode: "timestamp" }),
  dueAt: integer("due_at", { mode: "timestamp" }),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => sql`(unixepoch())`),
});
