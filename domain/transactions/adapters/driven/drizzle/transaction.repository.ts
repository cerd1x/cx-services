import { eq, and, asc, desc, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { transactionTable } from "$services/shared/infra/db/drizzle-schema";
import { Transaction } from "../../../core/model/transaction.model";
import { paymentMethodSchema } from "../../../core/model/transaction.model";
import type { PaymentMethod } from "../../../core/model/transaction.model";
import { TransactionRepository } from "../../../core/ports/out/transaction-repository.port";
import type { PageQuery, PageWindow } from "../../../core/model/transaction-page.model";
import { deserializeMoney, serializeMoney } from "$services/shared/infra/db/money";
import { ID } from "$services/shared/kernel";
import { logger } from "../../../core/value-objects/logger";

function positionOf(tx: Transaction): { createdAt: number; id: number } {
  return { createdAt: tx.createdAt!.getTime(), id: tx.id!.decode };
}

/**
 * Parse `payment_method` dari DB.
 *
 * Kolom ini menyimpan JSON seperti `{"type":"cash"}`. Tapi migration
 * `20260721132432_thick_matthew_murdock` mengganti default kolom dari `'cash'`
 * menjadi JSON tanpa mem-backfill nilai lama — baris yang sudah ada disalin
 * mentah, sehingga masih berisi string polos `'cash'` yang BUKAN JSON.
 *
 * `JSON.parse` mentah akan melempar `SyntaxError` di baris-baris itu, dan
 * karena mapper dipakai di setiap query, satu baris legacy cukup untuk
 * menggagalkan seluruh `transactions`. Jadi parse dibungkus dan bentuk legacy
 * dipetakan ke `{ type: "cash" }` yang setara.
 */
function parsePaymentMethod(raw: string): PaymentMethod {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("{")) {
    // Bentuk legacy: nama metode polos, mis. "cash".
    const parsed = paymentMethodSchema.safeParse({ type: trimmed });
    if (parsed.success) return parsed.data;

    logger.warn(`[Transaction] payment_method legacy tak dikenal: "${raw}", default ke cash`);
    return { type: "cash" };
  }

  try {
    const parsed = paymentMethodSchema.safeParse(JSON.parse(trimmed));
    if (parsed.success) return parsed.data;
    logger.warn(`[Transaction] payment_method tidak valid: "${raw}", default ke cash`);
  } catch {
    logger.warn(`[Transaction] payment_method bukan JSON: "${raw}", default ke cash`);
  }
  return { type: "cash" };
}

export class TransactionRepositoryImpl implements TransactionRepository {
  async save(transaction: Transaction): Promise<Transaction> {
    const result = await getDB()
      .insert(transactionTable)
      .values({
        userId: transaction.userId!,
        type: transaction.type,
        status: transaction.status,
        paymentStatus: transaction.paymentStatus,
        paymentMethod: JSON.stringify(transaction.paymentMethod),
        customerId: transaction.customerId ?? null,
        amount: serializeMoney(transaction.amount),
        capital: serializeMoney(transaction.capital),
        description: transaction.description ?? null,
        category: transaction.category ?? null,
        date: transaction.createdAt
          ? new Date(transaction.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        createdAt: transaction.createdAt ?? new Date(),
      })
      .returning();

    return this.#toTransaction(result[0]);
  }

  #toTransaction(row: typeof transactionTable.$inferSelect): Transaction {
    return new Transaction({
      userId: row.userId ?? undefined,
      type: row.type as Transaction["type"],
      status: row.status as Transaction["status"],
      paymentStatus: row.paymentStatus as Transaction["paymentStatus"],
      paymentMethod: parsePaymentMethod(row.paymentMethod),
      customerId: row.customerId ?? undefined,
      amount: deserializeMoney(row.amount),
      capital: deserializeMoney(row.capital),
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      id: row.id,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    });
  }

  async findById(id: number, userId: ID): Promise<Transaction | null> {
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(and(eq(transactionTable.id, id), eq(transactionTable.userId, userId.decode)))
      .limit(1);

    if (rows.length === 0) return null;

    return this.#toTransaction(rows[0]);
  }

  async findAll(userId: ID): Promise<Transaction[]> {
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(eq(transactionTable.userId, userId.decode));
    return rows.map((r) => this.#toTransaction(r));
  }

  async findByType(type: string, userId: ID): Promise<Transaction[]> {
    // `eq()` bertipe, bukan template `sql`, supaya nilai `type` ikut divalidasi
    // terhadap enum kolom dan tidak bisa meng-inject kolom/kolom typo.
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(
        and(
          eq(transactionTable.type, type as Transaction["type"]),
          eq(transactionTable.userId, userId.decode),
        ),
      );

    return rows.map((r) => this.#toTransaction(r));
  }

  async findByDateRange(start: Date, end: Date, userId: ID): Promise<Transaction[]> {
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(
        and(
          gte(transactionTable.createdAt, start),
          lte(transactionTable.createdAt, end),
          eq(transactionTable.userId, userId.decode),
        ),
      );

    return rows.map((r) => this.#toTransaction(r));
  }

  /**
   * Keyset predicate for the `createdAt DESC, id DESC` sort.
   *
   * `created_at` is a unix-second timestamp, so it is not unique: the `id`
   * tiebreak is what makes the boundary a strict, non-overlapping range.
   * `transaction_user_id_created_at_id_idx` serves both the predicate and the
   * ORDER BY, which is what keeps the cost at O(limit) instead of O(offset).
   */
  #boundary(position: { createdAt: number; id: number }, forward: boolean): SQL {
    const at = new Date(position.createdAt);
    return forward
      ? sql`(${transactionTable.createdAt} < ${at} OR (${transactionTable.createdAt} = ${at} AND ${transactionTable.id} < ${position.id}))`
      : sql`(${transactionTable.createdAt} > ${at} OR (${transactionTable.createdAt} = ${at} AND ${transactionTable.id} > ${position.id}))`;
  }

  async findPage(userId: ID, query: PageQuery): Promise<PageWindow> {
    const { limit, cursor, direction } = query;
    const position = cursor?.position ?? null;
    const forward = direction === "forward";
    const user = eq(transactionTable.userId, userId.decode);
    const boundary = position === null ? undefined : this.#boundary(position, forward);

    const orderByClause = forward
      ? [desc(transactionTable.createdAt), desc(transactionTable.id)]
      : [asc(transactionTable.createdAt), asc(transactionTable.id)];

    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(boundary === undefined ? user : and(user, boundary))
      .orderBy(...orderByClause)
      .limit(limit + 1);

    // The extra row is only an overflow probe and must be dropped before the
    // boundaries below are derived, otherwise the oldest row of the fetch would
    // be mistaken for the oldest row of the page.
    const items = rows.slice(0, limit).map((r) => this.#toTransaction(r));
    if (items.length === 0) {
      return { items, hasMore: false, hasLess: false };
    }

    // The page is contiguous in the (createdAt, id) sort, so its own two edges
    // are the boundaries. Rows arrive newest-first going forward and
    // oldest-first going backward, so the edges have to be picked by direction.
    const newest = forward ? items[0]! : items[items.length - 1]!;
    const oldest = forward ? items[items.length - 1]! : items[0]!;

    // Existence probes on each side of the page. Both are index seeks on
    // (user_id, created_at, id) rather than a COUNT over the user's rows, so
    // Relay's PageInfo gets an accurate hasNextPage/hasPreviousPage for free.
    const [hasMore, hasLess] = await Promise.all([
      this.#exists(user, this.#boundary(positionOf(oldest), forward)),
      this.#exists(user, this.#boundary(positionOf(newest), !forward)),
    ]);

    return { items, hasMore, hasLess };
  }

  async #exists(user: SQL, boundary: SQL): Promise<boolean> {
    const rows = await getDB()
      .select({ one: sql`1` })
      .from(transactionTable)
      .where(and(user, boundary))
      .limit(1);
    return rows.length > 0;
  }

  async update(transaction: Transaction, userId: ID): Promise<Transaction> {
    const result = await getDB()
      .update(transactionTable)
      .set({
        // `userId` sengaja tidak ikut di-set. `WHERE` di bawah memfilter dengan
        // userId pemanggil, jadi menulis `transaction.userId` dari payload
        // akan memindahkan row ke user lain dan membatalkan cek kepemilikan.
        // Kepemilikan hanya bisa berubah lewat jalur eksplisit.
        type: transaction.type,
        status: transaction.status,
        paymentStatus: transaction.paymentStatus,
        paymentMethod: JSON.stringify(transaction.paymentMethod),
        customerId: transaction.customerId ?? null,
        amount: serializeMoney(transaction.amount),
        capital: serializeMoney(transaction.capital),
        description: transaction.description ?? null,
        category: transaction.category ?? null,
      })
      .where(
        and(
          eq(transactionTable.id, transaction.id!.decode),
          eq(transactionTable.userId, userId.decode),
        ),
      )
      .returning();

    return this.#toTransaction(result[0]);
  }

  async delete(id: number, userId: ID): Promise<void> {
    await getDB()
      .delete(transactionTable)
      .where(and(eq(transactionTable.id, id), eq(transactionTable.userId, userId.decode)));
  }
}
