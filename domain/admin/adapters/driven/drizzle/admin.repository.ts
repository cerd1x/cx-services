import { desc, eq, sql } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { transactionTable } from "$services/shared/infra/db/drizzle-schema/transaction.schema";
import { assetTable } from "$services/shared/infra/db/drizzle-schema/asset.schema";
import { userRoleSchema, type UserRole } from "$services/domain/user";
import type {
  AdminOverview,
  AdminTransactionView,
  AdminUserView,
} from "../../../core/model/admin.model";
import { AdminRepository } from "../../../core/ports/out/admin-repository.port";

/**
 * `amount`/`capital` disimpan sebagai teks `"<ISO> <angka>"` (lihat
 * `formatMoney()` di `@lib/money`). Kode mata uang selalu 3 huruf
 * diikuti satu spasi, jadi angka mulai pada offset ke-5. Konversi dilakukan di
 * SQL supaya agregat atas seluruh tabel tidak perlu menarik semua baris ke
 * memory worker.
 */
const amountToReal = (column: typeof transactionTable.amount) =>
  sql<number>`cast(replace(substr(${column}, 5), ',', '') as real)`;

function toRole(value: unknown): UserRole {
  const parsed = userRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : "user";
}

function numeric(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class AdminRepositoryImpl implements AdminRepository {
  async listUsers(): Promise<AdminUserView[]> {
    const rows = await getDB().select().from(userTable).orderBy(userTable.id);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      role: toRole(row.role),
      avatarUrl: row.avatar,
      // `created_at` disimpan sebagai teks `CURRENT_TIMESTAMP` (UTC), jadi
      // `Z` dipakai agar tidak terbaca sebagai waktu lokal.
      createdAt: new Date(`${row.createdAt}Z`),
    }));
  }

  async getOverview(): Promise<AdminOverview> {
    const [userCount] = await getDB()
      .select({ total: sql<number>`count(*)` })
      .from(userTable);

    const [adminCount] = await getDB()
      .select({ total: sql<number>`count(*)` })
      .from(userTable)
      .where(eq(userTable.role, "admin"));

    const [txCount] = await getDB()
      .select({ total: sql<number>`count(*)` })
      .from(transactionTable);

    const [assetCount] = await getDB()
      .select({ total: sql<number>`count(*)` })
      .from(assetTable);

    /**
     * Income dan expense dijumlahkan terpisah lalu dikembalikan apa adanya:
     * tidak ada `totalProfit` karena `capital` bisa memakai mata uang berbeda
     * dari `amount`, sehingga selisihnya tidak selalu berarti.
     */
    const sums = await getDB()
      .select({
        type: transactionTable.type,
        total: sql<number>`sum(${amountToReal(transactionTable.amount)})`,
      })
      .from(transactionTable)
      .groupBy(transactionTable.type);

    const byType = new Map(sums.map((r) => [r.type, numeric(r.total)]));

    return {
      totalUsers: numeric(userCount?.total),
      totalAdmins: numeric(adminCount?.total),
      totalTransactions: numeric(txCount?.total),
      totalAssets: numeric(assetCount?.total),
      totalIncome: byType.get("income") ?? 0,
      totalExpense: byType.get("expense") ?? 0,
    };
  }

  async listUserTransactions(userId: number, limit: number): Promise<AdminTransactionView[]> {
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(eq(transactionTable.userId, userId))
      .orderBy(desc(transactionTable.createdAt), desc(transactionTable.id))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      status: row.status,
      paymentStatus: row.paymentStatus,
      amount: numeric(amountToReader(row.amount)),
      capital: numeric(amountToReader(row.capital)),
      description: row.description,
      category: row.category,
      date: row.date,
      createdAt: row.createdAt,
    }));
  }
}

/** Parse `"<ISO> <angka>"` menjadi angka; 0 bila format tak dikenali. */
function amountToReader(value: string): string {
  const parts = value.trim().split(" ");
  return parts.length >= 2 ? parts.slice(1).join(" ") : "0";
}
