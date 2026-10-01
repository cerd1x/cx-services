import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type ContactDto = {
  id: string;
  name: string;
  email: string | null;
  phones: string[] | null;
  group: string | null;
};

type PageDto = {
  contactConnection: {
    edges: Array<{ cursor: string; node: { id: string; name: string } }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

describe("contact e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("full contact lifecycle: create, list, get, update, delete", async () => {
    const { session } = await signUpUser();

    const create = await gql<{ createContact: ContactDto }>(
      `mutation($input: CreateContactInput!) {
        createContact(input: $input) { id name email phones group }
      }`,
      {
        input: {
          name: "Andi Wijaya",
          email: "andi@example.com",
          phones: ["+6281234567890", "+6289876543210"],
          group: "family",
        },
      },
      authHeaders(session),
    );
    expect(create.errors).toBeUndefined();
    expect(create.data!.createContact.name).toBe("Andi Wijaya");
    expect(create.data!.createContact.phones).toEqual(["+6281234567890", "+6289876543210"]);
    expect(create.data!.createContact.id).toBeTruthy();
    const contactId = create.data!.createContact.id;

    const list = await gql<{ contacts: ContactDto[] }>(
      `{ contacts { id name } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.errors).toBeUndefined();
    expect(list.data!.contacts.some((c) => c.name === "Andi Wijaya")).toBe(true);

    const get = await gql<{ contact: ContactDto }>(
      `query($id: String!) { contact(id: $id) { id name email phones group } }`,
      { id: contactId },
      authHeaders(session),
    );
    expect(get.errors).toBeUndefined();
    expect(get.data!.contact.email).toBe("andi@example.com");

    const update = await gql<{ updateContact: ContactDto }>(
      `mutation($id: String!, $input: UpdateContactInput!) {
        updateContact(id: $id, input: $input) { id name group }
      }`,
      { id: contactId, input: { name: "Andi W.", group: "work" } },
      authHeaders(session),
    );
    expect(update.errors).toBeUndefined();
    expect(update.data!.updateContact.name).toBe("Andi W.");
    expect(update.data!.updateContact.group).toBe("work");

    const del = await gql<{ deleteContact: boolean }>(
      `mutation($id: String!) { deleteContact(id: $id) }`,
      { id: contactId },
      authHeaders(session),
    );
    expect(del.errors).toBeUndefined();
    expect(del.data!.deleteContact).toBe(true);

    const afterDelete = await gql<{ contacts: ContactDto[] }>(
      `{ contacts { id name } }`,
      undefined,
      authHeaders(session),
    );
    expect(afterDelete.data!.contacts.some((c) => c.name === "Andi W.")).toBe(false);
  });

  describe("contactConnection keyset pagination", () => {
    const PAGE_QUERY = `query($first: Int, $after: String) {
      contactConnection(first: $first, after: $after) {
        edges { cursor node { id name } }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`;

    async function seed(session: string, count: number): Promise<string[]> {
      const ids: string[] = [];
      for (let i = 1; i <= count; i++) {
        const res = await gql<{ createContact: ContactDto }>(
          `mutation($input: CreateContactInput!) {
            createContact(input: $input) { id name }
          }`,
          { input: { name: `Paged ${String(i).padStart(2, "0")}` } },
          authHeaders(session),
        );
        expect(res.errors).toBeUndefined();
        ids.push(res.data!.createContact.id);
      }
      return ids;
    }

    async function fetchPage(
      session: string,
      after: string | null,
    ): Promise<PageDto["contactConnection"]> {
      const res = await gql<PageDto>(PAGE_QUERY, { first: 3, after }, authHeaders(session));
      expect(res.errors).toBeUndefined();
      return res.data!.contactConnection;
    }

    it("pages forwards with opaque cursors and visits every contact once", async () => {
      const { session } = await signUpUser();
      const ids = await seed(session, 7);
      const expected = ids.map((_, i) => `Paged ${String(i + 1).padStart(2, "0")}`).reverse();

      const names: string[] = [];
      const seenCursors: string[] = [];
      let after: string | null = null;
      let guard = 0;

      for (;;) {
        const { edges, pageInfo } = await fetchPage(session, after);
        names.push(...edges.map((e) => e.node.name));
        seenCursors.push(...edges.map((e) => e.cursor));
        expect(pageInfo.startCursor).toBe(edges[0]?.cursor ?? null);
        expect(pageInfo.endCursor).toBe(edges.at(-1)?.cursor ?? null);
        // Nothing precedes the newest contact, so only later pages report it.
        expect(pageInfo.hasPreviousPage).toBe(after !== null);

        if (!pageInfo.hasNextPage) break;
        after = pageInfo.endCursor;
        if (++guard > 10) throw new Error("pagination did not terminate");
      }

      expect(names).toEqual(expected);
      expect(new Set(seenCursors).size).toBe(seenCursors.length);
      // Cursors are opaque, not the contact id.
      expect(seenCursors.some((c) => ids.includes(c))).toBe(false);
    });

    it("reports an empty first page with no cursors for a user without contacts", async () => {
      const { session } = await signUpUser();

      const res = await gql<PageDto>(PAGE_QUERY, { first: 10 }, authHeaders(session));

      expect(res.errors).toBeUndefined();
      expect(res.data!.contactConnection.edges).toEqual([]);
      expect(res.data!.contactConnection.pageInfo).toEqual({
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      });
    });

    it("never returns another user's contacts", async () => {
      const mine = await signUpUser();
      const theirs = await signUpUser();
      await seed(mine.session, 3);
      await seed(theirs.session, 5);

      const res = await gql<PageDto>(PAGE_QUERY, { first: 50 }, authHeaders(mine.session));

      expect(res.errors).toBeUndefined();
      expect(res.data!.contactConnection.edges).toHaveLength(3);
      expect(res.data!.contactConnection.pageInfo.hasNextPage).toBe(false);
    });

    it("surfaces an invalid cursor as a GraphQL error", async () => {
      const { session } = await signUpUser();

      const res = await gql<PageDto>(
        PAGE_QUERY,
        { first: 5, after: "bogus" },
        authHeaders(session),
      );

      expect(res.errors).toBeDefined();
      expect(res.errors![0]!.message).toContain("cursor");
    });

    it("requires authentication", async () => {
      const res = await gql<PageDto>(PAGE_QUERY, { first: 5 });
      expect(res.errors).toBeDefined();
    });
  });
});
