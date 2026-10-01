import { ValidationError } from "$services/shared/kernel/errors/service-error";
import type { Contact } from "./contact.model";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const CURSOR_VERSION = "c1";

/**
 * Opaque keyset cursor for the contact list.
 *
 * Contacts are ordered by `id DESC`, so a cursor only needs to carry the `id` of
 * the last row handed to the client. The value is base64url encoded so the
 * ordering key is never exposed verbatim and the encoding can grow to a
 * compound key (e.g. `createdAt` + `id`) without a breaking change.
 */
export class Cursor {
  #id: number;

  private constructor(id: number) {
    this.#id = id;
  }

  static of(id: number): Cursor {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new ValidationError(`Invalid cursor position: ${id}`);
    }
    return new Cursor(id);
  }

  static encode(id: number): string {
    return toBase64Url(`${CURSOR_VERSION}:${id}`);
  }

  /** Throws ValidationError when the cursor was not produced by Cursor.encode. */
  static decode(raw: string): Cursor {
    const decoded = fromBase64Url(raw);
    if (decoded === null) {
      throw new ValidationError("Invalid cursor");
    }
    const separator = decoded.indexOf(":");
    if (separator === -1) {
      throw new ValidationError("Invalid cursor");
    }
    const version = decoded.slice(0, separator);
    if (version !== CURSOR_VERSION) {
      throw new ValidationError(`Unsupported cursor version: ${version}`);
    }
    const rawId = decoded.slice(separator + 1);
    if (!/^\d+$/.test(rawId)) {
      throw new ValidationError("Invalid cursor");
    }
    return Cursor.of(Number(rawId));
  }

  static parse(raw: string | null | undefined): Cursor | null {
    return raw === null || raw === undefined || raw === "" ? null : Cursor.decode(raw);
  }

  get position(): number {
    return this.#id;
  }

  toString(): string {
    return Cursor.encode(this.#id);
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

/** Page of contacts as returned by the repository, already trimmed to `limit`. */
export type PageWindow = {
  items: Contact[];
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

export type ContactPage = {
  items: Contact[];
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
 * `contacts` are ordered by `id DESC`, so a backward page is fetched with an
 * ascending keyset predicate and has to be flipped back before it is returned.
 */
export function toContactPage(window: PageWindow, direction: PageDirection): ContactPage {
  const items = direction === "backward" ? [...window.items].reverse() : window.items;

  return {
    items,
    cursors: items.map((contact) => Cursor.encode(contact.id?.toNumb ?? 0)),
    hasNextPage: direction === "forward" ? window.hasMore : window.hasLess,
    hasPreviousPage: direction === "forward" ? window.hasLess : window.hasMore,
  };
}
