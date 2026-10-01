import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { userTable } from "./user.schema";

/**
 * Token OAuth Gemini per-user (Opsi 1 — OAuth penuh).
 *
 * Menyimpan access token (pendek, ~1 jam) + refresh token (panjang) yang
 * didapat dari Google OAuth consent. Refresh token wajib disimpan aman di
 * backend (bukan di client Flutter). Access token di-refresh otomatis oleh
 * backend memakai refresh token.
 *
 * NOTE: Belum dicopy ke migration drizzle — perlu `drizzle-kit generate` +
 * apply (lihat docs Cloudflare Pages Dev/Deploy).
 */
export const geminiTokenTable = sqliteTable("gemini_oauth_token", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // userId adalah id user internal cxapp (bukan Google). Wajib unik — satu
  // user hanya punya satu koneksi Gemini.
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => userTable.id, { onDelete: "cascade" }),
  // Access token (short-lived) untuk memanggil Gemini, dalam bentuk
  // ter-encrypt di penyimpanan.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scope: text("scope"),
  tokenType: text("token_type").default("Bearer"),
  // Timestamp kedaluwarsa access token (epoch ms) — diisi dari `expires_in`.
  expiresAt: integer("expires_at").notNull(),
  projectId: text("project_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
