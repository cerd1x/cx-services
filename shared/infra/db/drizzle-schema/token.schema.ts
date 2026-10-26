import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";

export const tokenTable = sqliteTable("token", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => userTable.id, { onDelete: "cascade" }),
  sessionToken: text("session_token"),
  refreshToken: text("refresh_token"),
  expiredAtSession: integer("expired_at_session", { mode: "timestamp" }).notNull(),
  expiredAtRefresh: integer("expired_at_refresh", { mode: "timestamp" }).notNull(),
});
