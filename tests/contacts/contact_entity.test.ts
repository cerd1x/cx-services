import { describe, expect, it } from "bun:test";
import {
  Contact,
  MAX_PHONES,
  normalizePhones,
} from "$services/domain/contacts/core/model/contact.model";
import { ID } from "$services/shared/kernel/id";

describe("normalizePhones", () => {
  it("accepts a single phone string", () => {
    expect(normalizePhones("08123456789")).toEqual(["08123456789"]);
  });

  it("accepts an array and dedupes", () => {
    expect(normalizePhones(["08123456789", "08223456789", "08123456789"])).toEqual([
      "08123456789",
      "08223456789",
    ]);
  });

  it("trims and drops empty values", () => {
    expect(normalizePhones([" 08123456789 ", "", undefined as unknown as string])).toEqual([
      "08123456789",
    ]);
  });

  it("returns undefined for empty input", () => {
    expect(normalizePhones([])).toBeUndefined();
    expect(normalizePhones(undefined)).toBeUndefined();
    expect(normalizePhones(null)).toBeUndefined();
  });

  it(`caps at ${MAX_PHONES} numbers`, () => {
    const many = Array.from({ length: 15 }, (_, i) => `0810000000${i}`);
    expect(normalizePhones(many)).toHaveLength(MAX_PHONES);
  });
});

describe("Contact phones", () => {
  it("normalizes phone input in constructor", () => {
    const c = Contact.new({ name: "A", userId: ID.new(1), phones: ["08111111111", "08111111111"] });
    expect(c.phones).toEqual(["08111111111"]);
  });

  it("exposes the first phone via the compat getter", () => {
    const c = Contact.new({
      name: "A",
      userId: ID.new(1),
      phones: ["08111111111", "08222222222"],
    });
    expect(c.phone).toBe("08111111111");
  });

  it("phone setter promotes a number to be primary", () => {
    const c = Contact.new({
      name: "A",
      userId: ID.new(1),
      phones: ["08111111111", "08222222222"],
    });
    c.phone = "08222222222";
    expect(c.phone).toBe("08222222222");
    expect(c.phones).toEqual(["08222222222", "08111111111"]);
  });

  it("validatePhones throws when exceeding the limit", () => {
    const c = Contact.new({ name: "A", userId: ID.new(1) });
    c.phones = Array.from({ length: MAX_PHONES + 1 }, (_, i) => `0810000000${i}`);
    expect(() => c.validatePhones()).toThrow(`at most ${MAX_PHONES}`);
  });

  it("validatePhones throws on invalid phone format", () => {
    const c = Contact.new({ name: "A", userId: ID.new(1) });
    c.phones = ["0811111"];
    expect(() => c.validatePhones()).toThrow("at least 8 characters");
  });
});
