import { z } from "zod";
import { userRoleSchema } from "$services/domain/user";

/**
 * Batas atas jumlah baris yang boleh dikembalikan satu operasi admin.
 *
 * Endpoint admin adalah endpoint diagnosis, bukan reporting: cukup 200 baris
 * terakhir per user. Guard ini mencegah `limit` tak terbatas dipakai untuk
 * menarik seluruh isi database lewat satu request.
 */
export const ADMIN_PAGE_MAX_LIMIT = 200;

export const ADMIN_PAGE_DEFAULT_LIMIT = 50;

/** Bentuk user yang dilihat admin — tanpa `password`. */
export const adminUserViewSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
  role: userRoleSchema,
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
});

export type AdminUserView = z.infer<typeof adminUserViewSchema>;

/**
 * Agregat lintas seluruh user.
 *
 * `totalIncome`/`totalExpense` dijumlahkan dari kolom `amount` yang
 * disimpan sebagai teks `"<ISO> <angka>"`, jadi hanya bisa dijumlahkan dalam
 * satu mata uang — lihat catatan di `AdminRepositoryImpl.getOverview`.
 */
export const adminOverviewSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  totalAdmins: z.number().int().nonnegative(),
  totalTransactions: z.number().int().nonnegative(),
  totalAssets: z.number().int().nonnegative(),
  totalIncome: z.number(),
  totalExpense: z.number(),
});

export type AdminOverview = z.infer<typeof adminOverviewSchema>;

/**
 * Proyeksi transaksi untuk keperluan admin.
 *
 * Sengaja bentuk datar sendiri, bukan `Transaction` milik modul transactions:
 * modul itu tidak mengekspor entity tersebut lewat barrel, dan admin butuh
 * field (mis. `userId`) yang tidak relevan bagi user biasa.
 */
export const adminTransactionViewSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  type: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  amount: z.number(),
  capital: z.number(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  date: z.string(),
  createdAt: z.date(),
});

export type AdminTransactionView = z.infer<typeof adminTransactionViewSchema>;
