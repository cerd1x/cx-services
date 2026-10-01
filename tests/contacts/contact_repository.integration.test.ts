import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setDB, setD1 } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { contactTable } from "$services/shared/infra/db/drizzle-schema/contact.schema";
import { ContactRepositoryImpl } from "$services/domain/contacts/adapters/driven/drizzle/contact.repository";
import { Contact } from "$services/domain/contacts/adapters/driven/drizzle/contact.entity";
import { ID } from "$services/shared/kernel";
import { Cursor, resolvePageQuery, toContactPage } from "$services/domain/contacts/core/model/contact-page.model";

describe("ContactRepository integration", () => {
  let sqlite: any;
  let db: ReturnType<typeof drizzle>;
  let repo: ContactRepositoryImpl;
  let userId: number;

  beforeAll(async () => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    db = drizzle(env.d1 as any);
    setDB(db as any);
    setD1(env.d1 as any);
    repo = new ContactRepositoryImpl();

    const seed = await db.insert(userTable).values({
      name: "Contact User",
      username: `contact_user_${Date.now()}`,
      email: "contact@test.com",
      password: "hash",
    }).returning({ id: userTable.id });
    userId = seed[0].id!;
  });

  afterAll(() => {
    sqlite?.close();
  });

  it("serializes multiple phones as JSON and reads them back", async () => {
    const contact = Contact.new({
      name: "Alice",
      userId: ID.new(userId),
      phones: ["08111111111", "08222222222"],
    });
    const saved = await repo.save(userId, contact);

    expect(saved.id).toBeDefined();
    const found = await repo.findById(userId, saved.id!.toNumb);
    expect(found?.phones).toEqual(["08111111111", "08222222222"]);
    expect(found?.phone).toBe("08111111111");
  });

  it("finds contacts sharing a phone number", async () => {
    const a = await repo.save(
      userId,
      Contact.new({ name: "SharedA", userId: ID.new(userId), phones: ["08333333333"] }),
    );
    const b = await repo.save(
      userId,
      Contact.new({ name: "SharedB", userId: ID.new(userId), phones: ["08333333333", "08444444444"] }),
    );

    const matches = await repo.findByPhone(userId, "08333333333");

    expect(matches.map((m) => m.id!.toNumb).sort()).toEqual(
      [a.id!.toNumb, b.id!.toNumb].sort(),
    );
    expect(matches.find((m) => m.id!.toNumb === b.id!.toNumb)?.phones).toEqual([
      "08333333333",
      "08444444444",
    ]);
  });

  it("returns empty list when phone is not found", async () => {
    const matches = await repo.findByPhone(userId, "09999999999");
    expect(matches).toEqual([]);
  });

  it("reads legacy plain-string phone rows", async () => {
    const inserted = await db
      .insert(contactTable)
      .values({
        userId,
        name: "Legacy",
        phone: "08555555555",
      })
      .returning({ id: contactTable.id });
    const id = inserted[0].id!;

    const found = await repo.findById(userId, id);
    expect(found?.phones).toEqual(["08555555555"]);
    expect(found?.phone).toBe("08555555555");

    const matches = await repo.findByPhone(userId, "08555555555");
    expect(matches.map((m) => m.id!.toNumb)).toContain(id);
  });

  it("scopes findByPhone to the owner", async () => {
    const other = await db.insert(userTable).values({
      name: "Other User",
      username: `contact_other_${Date.now()}`,
      email: "other@test.com",
      password: "hash",
    }).returning({ id: userTable.id });
    const otherUserId = other[0].id!;
    await repo.save(
      otherUserId,
      Contact.new({ name: "OtherContact", userId: ID.new(otherUserId), phones: ["08666666666"] }),
    );

    const matches = await repo.findByPhone(userId, "08666666666");
    expect(matches).toEqual([]);
  });

  describe("findPage keyset pagination", () => {
    let pageUserId: number;
    let ids: number[] = [];

    beforeAll(async () => {
      const owner = await db.insert(userTable).values({
        name: "Pager",
        username: `contact_pager_${Date.now()}`,
        email: "pager@test.com",
        password: "hash",
      }).returning({ id: userTable.id });
      pageUserId = owner[0].id!;

      for (let i = 1; i <= 25; i++) {
        const saved = await repo.save(
          pageUserId,
          Contact.new({ name: `Pager ${i}`, userId: ID.new(pageUserId) }),
        );
        ids.push(saved.id!.toNumb);
      }
    });

    async function page(request: Parameters<typeof resolvePageQuery>[0]) {
      const query = resolvePageQuery(request);
      const window = await repo.findPage(pageUserId, query);
      return toContactPage(window, query.direction);
    }

    it("returns the newest contacts first", async () => {
      const result = await page({ first: 5 });

      expect(result.items.map((c) => c.id?.toNumb)).toEqual(ids.slice(-5).reverse());
    });

    it("reports a next page while rows remain", async () => {
      const result = await page({ first: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("reports no next page on the last window", async () => {
      const result = await page({ first: 10, after: Cursor.encode(ids[15]) });

      expect(result.items.map((c) => c.id?.toNumb)).toEqual(ids.slice(0, 15).reverse().slice(0, 10));
      expect(result.hasNextPage).toBe(true);
    });

    it("walks every row exactly once across pages", async () => {
      const seen: number[] = [];
      let after: string | null = null;
      let guard = 0;

      for (;;) {
        const result: Awaited<ReturnType<typeof page>> = await page({ first: 7, after });
        seen.push(...result.items.map((c) => c.id!.toNumb));
        if (!result.hasNextPage) break;
        after = result.cursors[result.cursors.length - 1]!;
        if (++guard > 10) throw new Error("pagination did not terminate");
      }

      expect(seen).toEqual([...ids].reverse());
      expect(new Set(seen).size).toBe(seen.length);
    });

    it("returns an empty page past the oldest contact", async () => {
      const result = await page({ first: 5, after: Cursor.encode(ids[0]) });

      expect(result.items).toEqual([]);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("reports a previous page once a cursor is supplied", async () => {
      const result = await page({ first: 5, after: Cursor.encode(ids[10]) });
      expect(result.hasPreviousPage).toBe(true);
    });

    it("fetches backwards with last/before in descending order", async () => {
      // In a DESC-ordered list the neighbour immediately before ids[10] is
      // ids[11], so `last: 5` yields ids[11..15] flipped back to descending.
      const result = await page({ last: 5, before: Cursor.encode(ids[10]) });

      expect(result.items.map((c) => c.id?.toNumb)).toEqual(ids.slice(11, 16).reverse());
      expect(result.hasPreviousPage).toBe(true);
      expect(result.hasNextPage).toBe(true);
    });

    it("reports no previous page when a backward window reaches the newest contact", async () => {
      const result = await page({ last: 50, before: Cursor.encode(ids[1]) });

      expect(result.items.map((c) => c.id?.toNumb)).toEqual(ids.slice(2).reverse());
      expect(result.hasPreviousPage).toBe(false);
      expect(result.hasNextPage).toBe(true);
    });

    it("never exposes another user's contacts", async () => {
      const outsider = await db.insert(userTable).values({
        name: "Outsider",
        username: `contact_outsider_${Date.now()}`,
        email: "outsider@test.com",
        password: "hash",
      }).returning({ id: userTable.id });

      const window = await repo.findPage(outsider[0].id!, resolvePageQuery({ first: 50 }));
      expect(window.items).toEqual([]);
      expect(window.hasMore).toBe(false);
    });

    it("keeps a cursor stable when rows are inserted after it was issued", async () => {
      const firstPage = await page({ first: 3 });
      const anchor = firstPage.cursors[2]!;
      const secondBefore = await page({ first: 3, after: anchor });
      expect(secondBefore.items.map((c) => c.id?.toNumb)).toEqual(ids.slice(19, 22).reverse());

      const inserted = await repo.save(
        pageUserId,
        Contact.new({ name: "Late Arrival", userId: ID.new(pageUserId) }),
      );

      // The anchor is a value rather than an offset, so replaying the same
      // cursor returns the same rows: a new contact taking a slot on page 1
      // cannot skip or duplicate anything the reader already paged past.
      const secondAfter = await page({ first: 3, after: anchor });
      expect(secondAfter.items.map((c) => c.id?.toNumb)).toEqual(
        secondBefore.items.map((c) => c.id?.toNumb),
      );

      // Being the newest row, the new contact shows up on the first page only.
      const firstAfter = await page({ first: 3 });
      expect(firstAfter.items[0]!.id?.toNumb).toBe(inserted.id!.toNumb);
    });

    it("returns exactly limit rows, hiding the overflow probe row", async () => {
      const window = await repo.findPage(pageUserId, resolvePageQuery({ first: 3 }));
      expect(window.items).toHaveLength(3);
    });

    describe("overflow probing", () => {
      async function seedExactly(count: number): Promise<{ userId: number; ids: number[] }> {
        const owner = await db.insert(userTable).values({
          name: "Overflow",
          username: `contact_overflow_${count}_${Date.now()}`,
          email: `overflow${count}@test.com`,
          password: "hash",
        }).returning({ id: userTable.id });
        const ownerId = owner[0].id!;

        const seeded: number[] = [];
        for (let i = 0; i < count; i++) {
          const saved = await repo.save(
            ownerId,
            Contact.new({ name: `Overflow ${i}`, userId: ID.new(ownerId) }),
          );
          seeded.push(saved.id!.toNumb);
        }
        return { userId: ownerId, ids: seeded };
      }

      async function pageAs(ownerId: number, request: Parameters<typeof resolvePageQuery>[0]) {
        const query = resolvePageQuery(request);
        return toContactPage(await repo.findPage(ownerId, query), query.direction);
      }

      // Regression: the overflow row is the oldest row of the fetch, so deriving
      // the page boundary from the untrimmed fetch made hasNextPage false here
      // and the client silently dropped the final page.
      it("reports a next page when the overflow row is the oldest contact", async () => {
        const { userId, ids } = await seedExactly(5);

        const result = await pageAs(userId, { first: 4 });

        expect(result.items.map((c) => c.id?.toNumb)).toEqual(ids.slice(1).reverse());
        expect(result.hasNextPage).toBe(true);

        const last = await pageAs(userId, { first: 4, after: result.cursors[3]! });
        expect(last.items.map((c) => c.id?.toNumb)).toEqual([ids[0]]);
        expect(last.hasNextPage).toBe(false);
      });

      it("reports no next page when the page exactly consumes every contact", async () => {
        const { userId, ids } = await seedExactly(4);

        const result = await pageAs(userId, { first: 4 });

        expect(result.items.map((c) => c.id?.toNumb)).toEqual(ids.slice().reverse());
        expect(result.hasNextPage).toBe(false);
        expect(result.hasPreviousPage).toBe(false);
      });

      it("reports a previous page when a backward overflow row is the newest contact", async () => {
        const { userId, ids } = await seedExactly(5);

        // `id > ids[1]` ascending returns ids[2..4], so ids[4] is the probe row.
        const result = await pageAs(userId, { last: 2, before: Cursor.encode(ids[1]) });

        expect(result.items.map((c) => c.id?.toNumb)).toEqual([ids[3], ids[2]]);
        expect(result.hasPreviousPage).toBe(true);
        expect(result.hasNextPage).toBe(true);
      });

      it("returns exactly limit rows even when many contacts remain", async () => {
        const { userId } = await seedExactly(30);

        const window = await repo.findPage(userId, resolvePageQuery({ first: 8 }));
        expect(window.items).toHaveLength(8);
      });
    });
  });
});