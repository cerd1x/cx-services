import { describe, expect, it } from "bun:test";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { Contact } from "$services/domain/contacts/core/entity/contact.entity";
import { ID } from "$services/shared/kernel";
import {
  Cursor,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeLimit,
  resolvePageQuery,
  toContactPage,
  type PageWindow,
} from "$services/domain/contacts/core/model/contact-page.model";

function contactWithId(id: number): Contact {
  const contact = Contact.new({ name: `Contact ${id}`, userId: ID.new(1) });
  contact.setId = id;
  return contact;
}

function windowOf(ids: number[], hasMore = false, hasLess = false): PageWindow {
  return { items: ids.map(contactWithId), hasMore, hasLess };
}

describe("Cursor", () => {
  it("round-trips the ordering position", () => {
    const encoded = Cursor.encode(42);
    expect(Cursor.decode(encoded).position).toBe(42);
  });

  it("does not leak the raw id", () => {
    expect(Cursor.encode(42)).not.toContain("42");
  });

  it("is url safe", () => {
    for (let id = 1; id <= 200; id++) {
      const encoded = Cursor.encode(id);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(Cursor.decode(encoded).position).toBe(id);
    }
  });

  it("rejects a non base64url payload", () => {
    expect(() => Cursor.decode("not a cursor!!")).toThrow(ValidationError);
  });

  it("rejects a payload without a version separator", () => {
    expect(() => Cursor.decode(btoa("no-separator"))).toThrow(ValidationError);
  });

  it("rejects an unknown version", () => {
    expect(() => Cursor.decode(btoa("c9:42"))).toThrow("Unsupported cursor version: c9");
  });

  it("rejects a non numeric position", () => {
    expect(() => Cursor.decode(btoa("c1:abc"))).toThrow(ValidationError);
  });

  it("rejects a non positive position", () => {
    expect(() => Cursor.of(0)).toThrow(ValidationError);
    expect(() => Cursor.of(-1)).toThrow(ValidationError);
    expect(() => Cursor.of(1.5)).toThrow(ValidationError);
  });

  it("parses empty input as no cursor", () => {
    expect(Cursor.parse(null)).toBeNull();
    expect(Cursor.parse(undefined)).toBeNull();
    expect(Cursor.parse("")).toBeNull();
  });

  it("parses a real cursor", () => {
    expect(Cursor.parse(Cursor.encode(7))?.position).toBe(7);
  });
});

describe("normalizeLimit", () => {
  it("defaults when omitted", () => {
    expect(normalizeLimit(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizeLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("clamps to the maximum page size", () => {
    expect(normalizeLimit(5000)).toBe(MAX_PAGE_SIZE);
  });

  it("rejects zero, negative and fractional sizes", () => {
    expect(() => normalizeLimit(0)).toThrow(ValidationError);
    expect(() => normalizeLimit(-3)).toThrow(ValidationError);
    expect(() => normalizeLimit(2.5)).toThrow(ValidationError);
  });
});

describe("resolvePageQuery", () => {
  it("defaults to a forward page of the default size", () => {
    expect(resolvePageQuery({})).toEqual({
      limit: DEFAULT_PAGE_SIZE,
      cursor: null,
      direction: "forward",
    });
  });

  it("maps first/after onto a forward keyset query", () => {
    const after = Cursor.encode(10);
    expect(resolvePageQuery({ first: 5, after })).toEqual({
      limit: 5,
      cursor: Cursor.decode(after),
      direction: "forward",
    });
  });

  it("maps last/before onto a backward keyset query", () => {
    const before = Cursor.encode(10);
    expect(resolvePageQuery({ last: 5, before })).toEqual({
      limit: 5,
      cursor: Cursor.decode(before),
      direction: "backward",
    });
  });

  it("ignores the opposite direction cursor", () => {
    const query = resolvePageQuery({ first: 5, before: Cursor.encode(10) });
    expect(query.cursor).toBeNull();
  });

  it("rejects the first/last combination the Relay spec forbids", () => {
    expect(() => resolvePageQuery({ first: 5, last: 5 })).toThrow(
      "Cannot combine 'first' with 'last'",
    );
  });

  it("rejects a malformed cursor", () => {
    expect(() => resolvePageQuery({ first: 5, after: "garbage!" })).toThrow(ValidationError);
  });
});

describe("toContactPage", () => {
  it("keeps the requested order for a forward page", () => {
    const page = toContactPage(windowOf([9, 8, 7], false, true), "forward");

    expect(page.items.map((c) => c.id?.toNumb)).toEqual([9, 8, 7]);
    expect(page.cursors).toEqual([Cursor.encode(9), Cursor.encode(8), Cursor.encode(7)]);
    expect(page.hasNextPage).toBe(false);
    expect(page.hasPreviousPage).toBe(true);
  });

  it("flips a backward page back into descending order", () => {
    const page = toContactPage(windowOf([3, 4, 5], true, false), "backward");

    expect(page.items.map((c) => c.id?.toNumb)).toEqual([5, 4, 3]);
    expect(page.cursors).toEqual([Cursor.encode(5), Cursor.encode(4), Cursor.encode(3)]);
  });

  it("swaps hasNextPage and hasPreviousPage for a backward page", () => {
    const page = toContactPage(windowOf([3, 4, 5], true, false), "backward");
    expect(page.hasPreviousPage).toBe(true);
    expect(page.hasNextPage).toBe(false);
  });

  it("returns an empty page when the window is empty", () => {
    const page = toContactPage(windowOf([]), "forward");
    expect(page.items).toEqual([]);
    expect(page.cursors).toEqual([]);
    expect(page.hasNextPage).toBe(false);
    expect(page.hasPreviousPage).toBe(false);
  });

  it("does not mutate the window it is given", () => {
    const window = windowOf([3, 4, 5]);
    toContactPage(window, "backward");
    expect(window.items.map((c) => c.id?.toNumb)).toEqual([3, 4, 5]);
  });
});
