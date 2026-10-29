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

  describe("scoped helpers", () => {
    it("encodes each aggregate with its own scope", () => {
      expect(ID.user(42).str).toBe(`USR.${ID.encode(42)}`);
      expect(ID.contact(42).str).toBe(`CT.${ID.encode(42)}`);
      expect(ID.asset(42).str).toBe(`AST.${ID.encode(42)}`);
      expect(ID.invoice(42).str).toBe(`INV.${ID.encode(42)}`);
      expect(ID.product(42).str).toBe(`PRD.${ID.encode(42)}`);
      expect(ID.order(42).str).toBe(`ORD.${ID.encode(42)}`);
      expect(ID.transaction(42).str).toBe(`TRX.${ID.encode(42)}`);
      expect(ID.payment(42).str).toBe(`PAY.${ID.encode(42)}`);
      expect(ID.setting(42).str).toBe(`STG.${ID.encode(42)}`);
      expect(ID.assetMutation(42).str).toBe(`AM.${ID.encode(42)}`);
    });

    it("round-trips every scoped id back to the database number", () => {
      const scopes = [
        ID.user,
        ID.contact,
        ID.asset,
        ID.invoice,
        ID.product,
        ID.order,
        ID.transaction,
        ID.payment,
        ID.setting,
        ID.assetMutation,
      ];

      for (const make of scopes) {
        const id = make(7);

        expect(ID.new(id.str).decode).toBe(7);
        expect(ID.is(id.str)).toBe(true);
      }
    });

    it("does not re-scope an already encoded id", () => {
      const id = ID.user(7);

      expect(ID.user(id.str).str).toBe(id.str);
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
