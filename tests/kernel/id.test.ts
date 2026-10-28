import { describe, expect, it } from "bun:test";
import { ID } from "$services/shared/kernel";

describe("ID", () => {
  describe("encode / decode", () => {
    it("encodes a numeric id to an sqids hash and decodes it back", () => {
      const id = ID.new(42);

      expect(id.toHash).toBe(ID.encode(42));
      expect(id.toHash).toHaveLength(10);
      expect(id.decode).toBe(42);
    });

    it("keeps raw string ids and decodes them via sqids", () => {
      const hash = ID.encode(7);
      const id = ID.new(hash);

      expect(id.decode).toBe(7);
      expect(id.toHash).toBe(hash);
    });

    it("compares ids by their numeric value", () => {
      expect(ID.new(1).eq(ID.new(1))).toBe(true);
      expect(ID.new(1).eq(ID.new("UkLWZg9DAJ"))).toBe(true);
      expect(ID.new(1).eq(1)).toBe(true);
      expect(ID.new(1).eq("UkLWZg9DAJ")).toBe(true);
      expect(ID.new(1).eq(2)).toBe(false);
    });
  });

  describe("withScope", () => {
    it("creates a composite encoded id from scope + number", () => {
      const id = ID.withScope("CT", 42);

      expect(id.toHash).toBe(`CT.${ID.encode(42)}`);
      expect(id.decode).toBe(42);
    });

    it("decodes composite scope ids back to the original number", () => {
      const id = ID.withScope("CT", 42);
      const roundTripped = ID.new(id.toHash);

      expect(roundTripped.decode).toBe(42);
      expect(roundTripped.eq(ID.withScope("CT", 42))).toBe(true);
      expect(roundTripped.eq(ID.withScope("CT", 43))).toBe(false);
    });

    it("scopes do not leak into the decoded numeric value", () => {
      expect(ID.withScope("U", 1).decode).toBe(1);
      expect(ID.withScope("INV", 9).decode).toBe(9);
    });
  });
});
