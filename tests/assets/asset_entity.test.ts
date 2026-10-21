import { describe, expect, it } from "bun:test";
import { Asset } from "$services/domain/assets/core/model/asset.model";
import { Money, iso } from "@lib/money";
import { ID } from "$services/shared/kernel";

describe("Asset", () => {
  it("create with valid input", () => {
    const asset = Asset.new({
      name: "BCA",
      type: "bank",
      userId: ID.new(1),
      balance: Money.fromNumber(500000, iso.IDR),
    });

    expect(asset.name).toBe("BCA");
    expect(asset.type).toBe("bank");
    expect(asset.currency.code).toBe("IDR");
    expect(asset.balance).toBeInstanceOf(Money);
    expect(asset.balance.toNumber()).toBe(500000);
  });

  it("create with ewallet type", () => {
    const asset = Asset.new({
      name: "GoPay",
      type: "ewallet",
      userId: ID.new(1),
      balance: Money.fromNumber(200, iso.USD),
    });

    expect(asset.type).toBe("ewallet");
  });

  it("create with crypto type", () => {
    const asset = Asset.new({
      name: "Crypto Wallet",
      type: "crypto",
      userId: ID.new(1),
      balance: Money.fromNumber(50, iso.CHF),
    });

    expect(asset.type).toBe("crypto");
  });

  it("create throws on empty name", () => {
    expect(() =>
      Asset.new({
        name: "",
        type: "cash",
        userId: ID.new(1),
        balance: Money.fromNumber(20000, iso.IDR),
      }),
    ).toThrow("Name is required");
  });

  it("create throws on negative balance", () => {
    const negativeBalance = Money.fromNumber(-100, iso.IDR);

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
      balance: Money.fromNumber(10000, iso.IDR),
    });
    const meta = asset.metadata;

    expect(meta.name).toBe("BNI");
    expect(meta.type).toBe("bank");
    expect(meta.balance).toBeInstanceOf(Money);
    expect(meta.balance.toNumber()).toBe(10000);
  });
});
