import { ValidationError } from "$services/shared/kernel/errors/service-error";
import type { Transaction } from "../../adapters/driven/drizzle/transaction.entity";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const CURSOR_VERSION = "c1";

/**
 * Opaque keyset cursor for the transaction list.
 *
 * Transactions are ordered by `createdAt DESC, id DESC`. `created_at` is stored
 * as a unix-second timestamp, so a batch of rows inserted in the same second
 * shares the same value and the cursor must carry the `id` of the last row as a
 * tiebreak. Paging on `createdAt` alone would drop those rows on one page and
 * repeat them on the next.
 *
 * The value is base64url encoded so the ordering key is never exposed verbatim
 * and a future version can widen the payload without a breaking change.
 */
export class Cursor {
  #createdAt: number;
  #id: number;

  private constructor(createdAt: number, id: number) {
    this.#createdAt = createdAt;
    this.#id = id;
  }

  /** @param createdAt Date or epoch milliseconds. */
  static of(createdAt: Date | number, id: number): Cursor {
    const ms = createdAt instanceof Date ? createdAt.getTime() : createdAt;
    if (!Number.isSafeInteger(ms) || ms < 0) {
      throw new ValidationError(`Invalid cursor position: ${createdAt}`);
    }
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new ValidationError(`Invalid cursor id: ${id}`);
    }
    return new Cursor(ms, id);
  }

  static encode(createdAt: Date | number, id: number): string {
    const ms = createdAt instanceof Date ? createdAt.getTime() : createdAt;
    return toBase64Url(`${CURSOR_VERSION}:${ms}:${id}`);
  }

  /** Throws ValidationError when the cursor was not produced by Cursor.encode. */
  static decode(raw: string): Cursor {
    const decoded = fromBase64Url(raw);
    if (decoded === null) {
      throw new ValidationError("Invalid cursor");
    }
    const parts = decoded.split(":");
    if (parts.length !== 3) {
      throw new ValidationError("Invalid cursor");
    }
    const [version, rawCreatedAt, rawId] = parts as [string, string, string];
    if (version !== CURSOR_VERSION) {
      throw new ValidationError(`Unsupported cursor version: ${version}`);
    }
    if (!/^\d+$/.test(rawCreatedAt) || !/^\d+$/.test(rawId)) {
      throw new ValidationError("Invalid cursor");
    }
    return Cursor.of(Number(rawCreatedAt), Number(rawId));
  }

  static parse(raw: string | null | undefined): Cursor | null {
    return raw === null || raw === undefined || raw === "" ? null : Cursor.decode(raw);
  }

  /** Keyset boundary in epoch milliseconds, paired with the tiebreak `id`. */
  get position(): { createdAt: number; id: number } {
    return { createdAt: this.#createdAt, id: this.#id };
  }

  toString(): string {
    return Cursor.encode(this.#createdAt, this.#id);
  }
}

export type PageDirection = "forward" | "backward";

export type PageQuery = {
  /** Rows requested in the current window. */
  limit: number;
  /** Exclusive keyset boundary; rows strictly past the cursor in sort order. */
  cursor: Cursor | null;
  direction: PageDirection;
};

/** Page of transactions as returned by the repository, already trimmed to `limit`. */
export type PageWindow = {
  items: Transaction[];
  /** At least one more row exists beyond the page in the sort direction. */
  hasMore: boolean;
  /** At least one row exists before the page in the sort direction. */
  hasLess: boolean;
};

export type PageRequest = {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
};

export type TransactionPage = {
  items: Transaction[];
  cursors: string[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const withPad = pad === 0 ? padded : padded + "=".repeat(4 - pad);
    return atob(withPad);
  } catch {
    return null;
  }
}

/**
 * Translates Relay connection arguments into a keyset query. Rejects the
 * `first`/`last` combination the Relay spec forbids so clients get an explicit
 * error instead of silently getting a window they did not ask for.
 */
export function resolvePageQuery(request: PageRequest): PageQuery {
  const hasFirst = request.first !== null && request.first !== undefined;
  const hasLast = request.last !== null && request.last !== undefined;

  if (hasFirst && hasLast) {
    throw new ValidationError("Cannot combine 'first' with 'last'");
  }

  const direction: PageDirection = hasLast ? "backward" : "forward";
  const requested = hasLast ? request.last! : request.first!;
  const limit = normalizeLimit(requested);
  const rawCursor = direction === "backward" ? request.before : request.after;

  return { limit, cursor: Cursor.parse(rawCursor), direction };
}

export function normalizeLimit(value: number | null | undefined): number {
  if (value === null || value === undefined) return DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(value) || value < 1) {
    throw new ValidationError(`Invalid page size: ${value}`);
  }
  return Math.min(value, MAX_PAGE_SIZE);
}

/**
 * Turns a repository page into a Relay-ready result.
 *
 * `createdAt DESC, id DESC` is the sort order, so a backward page is fetched
 * with ascending keyset predicates and has to be flipped back before it is
 * returned.
 */
export function toTransactionPage(window: PageWindow, direction: PageDirection): TransactionPage {
  const items = direction === "backward" ? [...window.items].reverse() : window.items;

  return {
    items,
    cursors: items.map((tx) => Cursor.encode(tx.createdAt ?? new Date(0), tx.id?.toNumb ?? 0)),
    hasNextPage: direction === "forward" ? window.hasMore : window.hasLess,
    hasPreviousPage: direction === "forward" ? window.hasLess : window.hasMore,
  };
}
