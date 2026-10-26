import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";

export const contactTable = sqliteTable(
  "contact",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    group: text("group"),
    avatar: text("avatar"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .$onUpdate(() => sql`(unixepoch())`),
  },
  (t) => [
    // Supports the keyset predicate used by ContactRepositoryImpl.findPage:
    // WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT ?
    index("contact_user_id_id_idx").on(t.userId, t.id),
  ],
);
