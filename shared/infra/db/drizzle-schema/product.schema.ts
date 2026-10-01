import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { userTable } from "./user.schema";

export const productTable = sqliteTable("product", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  capital: real("capital"),
  currency: text("currency", { length: 3 }).notNull(),
  stock: integer("stock").notNull().default(0),
  trackStock: integer("track_stock").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at"),
});
