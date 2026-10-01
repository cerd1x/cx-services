import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { userTable } from "./user.schema";

export const assetTable = sqliteTable("asset", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["bank", "ewallet", "cash", "loan", "crypto"] }).notNull(),
  balance: real("balance").notNull().default(0),
  currency: text("currency", { length: 4 }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
