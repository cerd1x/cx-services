import type { Transaction } from "../../../adapters/driven/drizzle/transaction.entity";
import type { ID } from "$services/shared/kernel";
import type { PageQuery, PageWindow } from "../../model/transaction-page.model";

export abstract class TransactionRepository {
  abstract save(transaction: Transaction): Promise<Transaction>;
  abstract findById(id: number, userId: ID): Promise<Transaction | null>;
  abstract findAll(userId: ID): Promise<Transaction[]>;
  abstract findByType(type: string, userId: ID): Promise<Transaction[]>;
  abstract findByDateRange(start: Date, end: Date, userId: ID): Promise<Transaction[]>;
  /**
   * Keyset page of a user's transactions ordered by `createdAt DESC, id DESC`.
   *
   * Implementations must return at most `query.limit` rows and must report
   * `hasMore`/`hasLess` for that page, so the caller can fill Relay's PageInfo
   * without knowing how many rows the user owns in total.
   */
  abstract findPage(userId: ID, query: PageQuery): Promise<PageWindow>;
  abstract update(transaction: Transaction, userId: ID): Promise<Transaction>;
  abstract delete(id: number, userId: ID): Promise<void>;
}
