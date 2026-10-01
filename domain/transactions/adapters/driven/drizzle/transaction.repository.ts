import { eq, and, asc, desc, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { transactionTable } from "$services/shared/infra/db/drizzle-schema";
import { Transaction } from "../../../core/model/transaction.model";
import { TransactionRepository } from "../../../core/ports/out/transaction-repository.port";
import type { PageQuery, PageWindow } from "../../../core/model/transaction-page.model";
import { Balance } from "../../../../assets/core/value-objects/balance.vo";
import { ID } from "$services/shared/kernel";

function positionOf(tx: Transaction): { createdAt: number; id: number } {
  return { createdAt: tx.createdAt!.getTime(), id: tx.id!.toNumb };
}

export class TransactionRepositoryImpl implements TransactionRepository {
  async save(transaction: Transaction): Promise<Transaction> {
    const result = await getDB()
      .insert(transactionTable)
      .values({
        userId: transaction.userId!,
        type: transaction.type,
        status: transaction.status,
        paymentMethod: JSON.stringify(transaction.paymentMethod),
        customerId: transaction.customerId ?? null,
        amount: `${transaction.amount.code} ${transaction.amount.value}`,
        capital: `${transaction.capital.code} ${transaction.capital.value}`,
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
      paymentMethod:
        typeof row.paymentMethod === "string" ? JSON.parse(row.paymentMethod) : row.paymentMethod,
      customerId: row.customerId ?? undefined,
      amount: Balance.new(row.amount),
      capital: Balance.new(row.capital),
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
      .where(and(eq(transactionTable.id, id), eq(transactionTable.userId, userId.toNumb)))
      .limit(1);

    if (rows.length === 0) return null;

    return this.#toTransaction(rows[0]);
  }

  async findAll(userId: ID): Promise<Transaction[]> {
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(eq(transactionTable.userId, userId.toNumb));
    return rows.map((r) => this.#toTransaction(r));
  }

  async findByType(type: string, userId: ID): Promise<Transaction[]> {
    const rows = await getDB()
      .select()
      .from(transactionTable)
      .where(and(sql`type = ${type}`, eq(transactionTable.userId, userId.toNumb)));

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
          eq(transactionTable.userId, userId.toNumb),
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
    const user = eq(transactionTable.userId, userId.toNumb);
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
        userId: transaction.userId!,
        type: transaction.type,
        status: transaction.status,
        paymentMethod: JSON.stringify(transaction.paymentMethod),
        customerId: transaction.customerId ?? null,
        amount: `${transaction.amount.code} ${transaction.amount.value}`,
        capital: `${transaction.capital.code} ${transaction.capital.value}`,
        description: transaction.description ?? null,
        category: transaction.category ?? null,
      })
      .where(
        and(
          eq(transactionTable.id, transaction.id!.toNumb),
          eq(transactionTable.userId, userId.toNumb),
        ),
      )
      .returning();

    return this.#toTransaction(result[0]);
  }

  async delete(id: number, userId: ID): Promise<void> {
    await getDB()
      .delete(transactionTable)
      .where(and(eq(transactionTable.id, id), eq(transactionTable.userId, userId.toNumb)));
  }
}
