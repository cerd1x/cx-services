import { describe, expect, it } from "bun:test";
import { AssetMutation } from "$services/domain/assets/core/entity/asset-mutation.entity";
import { ID } from "$services/shared/kernel";

describe("AssetMutation", () => {
  it("creates with valid input", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "add",
      amount: 100,
      currency: "USD",
      balanceBefore: "USD 200",
      balanceAfter: "USD 300",
    });

    expect(m.type).toBe("add");
    expect(m.amount).toBe(100);
    expect(m.currency).toBe("USD");
    expect(m.balanceBefore).toBe("USD 200");
    expect(m.balanceAfter).toBe("USD 300");
    expect(m.description).toBeNull();
  });

  it("creates with description", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "subtract",
      amount: 50,
      currency: "IDR",
      balanceBefore: "IDR 500",
      balanceAfter: "IDR 450",
      description: "purchase",
    });

    expect(m.description).toBe("purchase");
  });

  it("creates with transaction type", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "transaction",
      amount: 30,
      currency: "USD",
      balanceBefore: "USD 100",
      balanceAfter: "USD 70",
    });

    expect(m.type).toBe("transaction");
  });

  it("requiredId throws when id is missing", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "add",
      amount: 100,
      currency: "USD",
      balanceBefore: "USD 200",
      balanceAfter: "USD 300",
    });

    expect(() => m.requiredId()).toThrow("id is required");
  });

  it("requiredDescription throws when description is null", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "add",
      amount: 100,
      currency: "USD",
      balanceBefore: "USD 200",
      balanceAfter: "USD 300",
    });

    expect(() => m.requiredDescription()).toThrow("description is required");
  });

  it("metadata returns snapshot", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "subtract",
      amount: 50,
      currency: "IDR",
      balanceBefore: "IDR 500",
      balanceAfter: "IDR 450",
    });

    const meta = m.metadata;
    expect(meta.type).toBe("subtract");
    expect(meta.amount).toBe(50);
    expect(meta.currency).toBe("IDR");
    expect(meta.balanceBefore).toBe("IDR 500");
    expect(meta.balanceAfter).toBe("IDR 450");
    expect(meta.description).toBeNull();
    expect(meta.id).toBeUndefined();
  });
});
