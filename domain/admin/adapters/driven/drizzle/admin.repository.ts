import { desc, eq, sql } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { deserializeMoney } from "$services/shared/infra/db/money";
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
 * `amount`/`capital` disimpan sebagai string instance `Money`
 * (`"IDR 1500000"`, ISO code + decimal — bukan JSON). Konversi ke angka via
 * helper `deserializeMoney` (format string `"KODE NOMINAL"`).
 */
function amountToReal(value: string): number {
  try {
    return deserializeMoney(value).toNumber();
  } catch {
    return 0;
  }
}

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
      createdAt: row.createdAt,
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
    const rows = await getDB()
      .select({
        type: transactionTable.type,
        amount: transactionTable.amount,
      })
      .from(transactionTable);

    const totalIncome = rows
      .filter((r) => r.type === "income")
      .reduce((sum, r) => sum + amountToReal(r.amount), 0);
    const totalExpense = rows
      .filter((r) => r.type === "expense")
      .reduce((sum, r) => sum + amountToReal(r.amount), 0);

    return {
      totalUsers: numeric(userCount?.total),
      totalAdmins: numeric(adminCount?.total),
      totalTransactions: numeric(txCount?.total),
      totalAssets: numeric(assetCount?.total),
      totalIncome,
      totalExpense,
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

/** Parse string instance `Money` ("IDR 1500000") menjadi nominalnya; "0" bila tak dikenali. */
function amountToReader(value: string): string {
  try {
    return deserializeMoney(value).toNumber().toString();
  } catch {
    return "0";
  }
}
