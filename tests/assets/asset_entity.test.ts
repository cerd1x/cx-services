import { describe, expect, it } from "bun:test";
import { Asset } from "$services/domain/assets/core/model/asset.model";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import { ID } from "$services/shared/kernel";

describe("Asset", () => {
  it("create with valid input", () => {
    const asset = Asset.new({
      name: "BCA",
      type: "bank",
      userId: ID.new(1),
      balance: Balance.new("IDR 500000"),
    });

    expect(asset.name).toBe("BCA");
    expect(asset.type).toBe("bank");
    expect(asset.currency.code).toBe("IDR");
    expect(asset.balance).toBe("IDR 500000");
  });

  it("create with ewallet type", () => {
    const asset = Asset.new({
      name: "GoPay",
      type: "ewallet",
      userId: ID.new(1),
      balance: Balance.new("USD 200"),
    });

    expect(asset.type).toBe("ewallet");
  });

  it("create with crypto type", () => {
    const asset = Asset.new({
      name: "Crypto Wallet",
      type: "crypto",
      userId: ID.new(1),
      balance: Balance.new("CHF 50"),
    });

    expect(asset.type).toBe("crypto");
  });

  it("create throws on empty name", () => {
    expect(() =>
      Asset.new({
        name: "",
        type: "cash",
        userId: ID.new(1),
        balance: Balance.new("IDR 20000"),
      }),
    ).toThrow("Name is required");
  });

  it("create throws on negative balance", () => {
    const negativeBalance = Balance.new("IDR 100");
    Object.defineProperty(negativeBalance, "value", { get: () => -1 });

    expect(() =>
      Asset.new({
        name: "BCA",
        type: "bank",
        userId: ID.new(1),
        balance: negativeBalance,
      }),
    ).toThrow("Balance must be non-negative");
  });

  it("metadata returns AssetData snapshot", () => {
    const asset = Asset.new({
      name: "BNI",
      type: "bank",
      userId: ID.new(1),
      balance: Balance.new("IDR 10000"),
    });
    const meta = asset.metadata;

    expect(meta.name).toBe("BNI");
    expect(meta.type).toBe("bank");
    expect(meta.balance).toBe("10000");
  });
});
