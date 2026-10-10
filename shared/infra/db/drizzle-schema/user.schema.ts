import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Peran user. Satu-satunya sumber kebenaran untuk RBAC.
 *
 * Nilainya disimpan sebagai teks polos (bukan enum D1) supaya penambahan peran
 * baru cukup di `userRoleSchema` — tanpa perlu `ALTER TABLE` pada tabel yang
 * sudah berisi data production.
 */
export const userRoleValues = ["user", "admin"] as const;

export type UserRoleValue = (typeof userRoleValues)[number];

export const userTable = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  role: text("role", { enum: userRoleValues }).notNull().default("user"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
