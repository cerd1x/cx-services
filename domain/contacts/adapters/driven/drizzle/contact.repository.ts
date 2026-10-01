import { and, asc, desc, eq, gt, lt, or, sql, type SQL } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { Contact } from "../../../core/entity/contact.entity";
import { ContactRepository } from "../../../core/ports/out/contact-repository.port";
import type { PageQuery, PageWindow } from "../../../core/model/contact-page.model";
import { contactTable } from "$services/shared/infra/db/drizzle-schema";
import { ID } from "$services/shared/kernel";

function serializePhones(phones: string[] | undefined): string | null {
  return phones && phones.length > 0 ? JSON.stringify(phones) : null;
}

function deserializePhones(value: string | null): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to legacy handling below
  }
  // Legacy row: plain phone string stored before multi-phone support.
  return [value];
}

function toContact(row: {
  id: number;
  userId: number;
  name: string;
  email: string | null;
  phone: string | null;
  group: string | null;
  avatar: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): Contact {
  return new Contact({
    id: row.id,
    userId: ID.new(row.userId),
    name: row.name,
    email: row.email ?? undefined,
    phones: deserializePhones(row.phone),
    group: row.group ?? undefined,
    avatar: row.avatar ?? undefined,
    createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
  });
}

export class ContactRepositoryImpl implements ContactRepository {
  async save(_userId: number, contact: Contact): Promise<Contact> {
    const result = await getDB()
      .insert(contactTable)
      .values({
        userId: contact.userId?.toNumb ?? null,
        name: contact.name,
        email: contact.email ?? null,
        phone: serializePhones(contact.phones),
        group: contact.group ?? null,
        avatar: contact.avatar ?? null,
      })
      .returning();

    return toContact(result[0]);
  }

  async findById(userId: number, id: number): Promise<Contact | null> {
    const rows = await getDB()
      .select()
      .from(contactTable)
      .where(and(eq(contactTable.userId, userId), eq(contactTable.id, id)))
      .limit(1);
    if (rows.length === 0) {
      return null;
    }

    return toContact(rows[0]);
  }

  async findAll(userId: number): Promise<Contact[]> {
    const rows = await getDB().select().from(contactTable).where(eq(contactTable.userId, userId));
    return rows.filter((r) => r.userId != null).map((r) => toContact(r));
  }

  async findPage(userId: number, query: PageQuery): Promise<PageWindow> {
    const { limit, cursor, direction } = query;
    const position = cursor?.position ?? null;
    const forward = direction === "forward";

    // Keyset predicate: the sort key is the AUTOINCREMENT primary key, so the
    // boundary is a single strict comparison and no tiebreak column is needed.
    // `contact_user_id_id_idx` serves both the predicate and the ORDER BY, which
    // is what keeps the cost at O(limit) instead of O(offset).
    const boundary =
      position === null
        ? undefined
        : forward
          ? lt(contactTable.id, position)
          : gt(contactTable.id, position);

    const rows = await getDB()
      .select()
      .from(contactTable)
      .where(
        boundary === undefined
          ? eq(contactTable.userId, userId)
          : and(eq(contactTable.userId, userId), boundary),
      )
      .orderBy(forward ? desc(contactTable.id) : asc(contactTable.id))
      .limit(limit + 1);

    // The extra row is only an overflow probe and must be dropped before the
    // boundaries below are derived, otherwise the oldest row of the fetch would
    // be mistaken for the oldest row of the page.
    const items = rows.slice(0, limit).map((r) => toContact(r));
    if (items.length === 0) {
      return { items, hasMore: false, hasLess: false };
    }

    const ids = items.map((c) => c.id!.toNumb);
    const lowest = Math.min(...ids);
    const highest = Math.max(...ids);

    // Existence probes on each side of the page. Both are index seeks on
    // (user_id, id) rather than a COUNT over the user's rows, so Relay's
    // PageInfo gets an accurate hasNextPage/hasPreviousPage for free.
    const [hasMore, hasLess] = await Promise.all([
      this.#exists(userId, forward ? lt(contactTable.id, lowest) : gt(contactTable.id, highest)),
      this.#exists(userId, forward ? gt(contactTable.id, highest) : lt(contactTable.id, lowest)),
    ]);

    return { items, hasMore, hasLess };
  }

  async #exists(userId: number, boundary: SQL): Promise<boolean> {
    const rows = await getDB()
      .select({ one: sql`1` })
      .from(contactTable)
      .where(and(eq(contactTable.userId, userId), boundary))
      .limit(1);
    return rows.length > 0;
  }

  async findByPhone(userId: number, phone: string): Promise<Contact[]> {
    const escaped = phone.replace(/[\\%_]/g, (m) => `\\${m}`);
    const jsonPattern = `%"${escaped}"%`;
    const rows = await getDB()
      .select()
      .from(contactTable)
      .where(
        and(
          eq(contactTable.userId, userId),
          or(
            sql`${contactTable.phone} LIKE ${jsonPattern} ESCAPE '\\'`,
            // legacy rows: phone column stores the plain phone string
            eq(contactTable.phone, phone),
          ),
        ),
      );
    return rows.filter((r) => r.userId != null).map((r) => toContact(r));
  }

  async update(userId: number, contact: Contact): Promise<Contact> {
    const result = await getDB()
      .update(contactTable)
      .set({
        userId: contact.userId?.toNumb ?? null,
        name: contact.name,
        email: contact.email ?? null,
        phone: serializePhones(contact.phones),
        group: contact.group ?? null,
        avatar: contact.avatar ?? null,
      })
      .where(and(eq(contactTable.userId, userId), eq(contactTable.id, contact.id!.toNumb)))
      .returning();

    return toContact(result[0]);
  }

  async delete(userId: number, id: number): Promise<void> {
    await getDB()
      .delete(contactTable)
      .where(and(eq(contactTable.userId, userId), eq(contactTable.id, id)));
  }
}
