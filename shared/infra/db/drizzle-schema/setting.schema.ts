import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { userTable } from "./user.schema";

export const settingTable = sqliteTable("setting", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => userTable.id, { onDelete: "cascade" }),
  currency: text("currency", { length: 4 }).notNull().default("IDR"),
  darkMode: integer("dark_mode", { mode: "boolean" }).notNull().default(false),
  dateFormat: text("date_format", { length: 30 })
    .notNull()
    .default("d MMM yyyy, HH:mm"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
