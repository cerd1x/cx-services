import type { AdminOverview, AdminTransactionView, AdminUserView } from "../../model/admin.model";

/**
 * Port untuk baca lintas-user.
 *
 * Modul lain (user, transactions) sengaja tidak dipakai untuk ini: repository
 * mereka didesain terisolasi per `user_id`, dan `user` tidak mengekspor
 * `UserRepository` lewat barrel. Port ini adalah satu-satunya jalur baca yang
 * sengaja melintasi batas kepemilikan data.
 *
 * Semua method di sini **hanya boleh** dipanggil dari use case yang sudah
 * melewati gate `@admin` di lapisan GraphQL.
 */
export abstract class AdminRepository {
  abstract listUsers(): Promise<AdminUserView[]>;
  abstract getOverview(): Promise<AdminOverview>;
  abstract listUserTransactions(userId: number, limit: number): Promise<AdminTransactionView[]>;
}
