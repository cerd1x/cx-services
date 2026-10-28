import { describe, expect, it } from "bun:test";
import { AssetMutation } from "$services/domain/assets/core/model/asset-mutation.model";
import { Money, iso } from "@lib/money";
import { ID } from "$services/shared/kernel";

describe("AssetMutation", () => {
  it("creates with valid input", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "CR",
      amount: Money.fromNumber(100, iso.USD),
      balanceBefore: Money.fromNumber(200, iso.USD),
      balanceAfter: Money.fromNumber(300, iso.USD),
    });

    expect(m.type).toBe("CR");
    expect(m.amount).toBeInstanceOf(Money);
    expect(m.amount.toNumber()).toBe(100);
    expect(m.currency).toBe("USD");
    expect(m.balanceBefore.toNumber()).toBe(200);
    expect(m.balanceAfter.toNumber()).toBe(300);
    expect(m.description).toBeNull();
  });

  it("creates with description", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "DB",
      amount: Money.fromNumber(50, iso.IDR),
      balanceBefore: Money.fromNumber(500, iso.IDR),
      balanceAfter: Money.fromNumber(450, iso.IDR),
      description: "purchase",
    });

    expect(m.description).toBe("purchase");
  });

  it("creates with transaction type", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "EB",
      amount: Money.fromNumber(30, iso.USD),
      balanceBefore: Money.fromNumber(100, iso.USD),
      balanceAfter: Money.fromNumber(70, iso.USD),
    });

    expect(m.type).toBe("EB");
  });

  it("requiredId throws when id is missing", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "CR",
      amount: Money.fromNumber(100, iso.USD),
      balanceBefore: Money.fromNumber(200, iso.USD),
      balanceAfter: Money.fromNumber(300, iso.USD),
    });

    expect(() => m.requiredId()).toThrow("id is required");
  });

  it("requiredDescription throws when description is null", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "CR",
      amount: Money.fromNumber(100, iso.USD),
      balanceBefore: Money.fromNumber(200, iso.USD),
      balanceAfter: Money.fromNumber(300, iso.USD),
    });

    expect(() => m.requiredDescription()).toThrow("description is required");
  });

  it("metadata returns snapshot", () => {
    const m = AssetMutation.new({
      userId: ID.new(1),
      assetId: 1,
      type: "DB",
      amount: Money.fromNumber(50, iso.IDR),
      balanceBefore: Money.fromNumber(500, iso.IDR),
      balanceAfter: Money.fromNumber(450, iso.IDR),
    });

    const meta = m.metadata;
    expect(meta.type).toBe("DB");
    expect(meta.amount.toNumber()).toBe(50);
    expect(meta.currency).toBe("IDR");
    expect(meta.balanceBefore.toNumber()).toBe(500);
    expect(meta.balanceAfter.toNumber()).toBe(450);
    expect(meta.description).toBeNull();
    expect(meta.id).toBeUndefined();
  });
});
