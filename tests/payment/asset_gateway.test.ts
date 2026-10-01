import { describe, expect, it } from "bun:test";
import { AssetPaymentGateway } from "$services/domain/payment/adapters/driven/payment-gateway/asset-gateway.adapter";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import { ID } from "$services/shared/kernel";

function createFakeAssets(initial: Record<number, { name: string; balance: string }>) {
  const store = new Map<number, { name: string; balance: string }>();
  Object.entries(initial).forEach(([id, v]) => store.set(Number(id), { ...v }));

  const mutate = (assetId: number, op: "add" | "subtract", amount: string) => {
    const entry = store.get(assetId);
    if (!entry) throw new Error(`Asset ${assetId} not found`);
    const balance = Balance.new(entry.balance);
    const delta = Balance.new(amount);
    if (op === "subtract") balance.subtract(delta);
    else balance.add(delta);
    entry.balance = balance.toString();
  };

  const toEntity = (id: number) => {
    const entry = store.get(id)!;
    return {
      IdStr: ID.new(id).toHash,
      name: entry.name,
      balance: entry.balance,
    };
  };

  return {
    store,
    async assets(_userId: ID) {
      return [...store.keys()].map(toEntity);
    },
    async assetById(_userId: ID, assetId: ID) {
      const id = assetId.toNumb;
      return store.has(id) ? toEntity(id) : null;
    },
    async mutateSubtractAsset(userId: ID, assetId: ID, amount: string) {
      mutate(assetId.toNumb, "subtract", amount);
      return toEntity(assetId.toNumb);
    },
    async mutateAddAsset(userId: ID, assetId: ID, amount: string) {
      mutate(assetId.toNumb, "add", amount);
      return toEntity(assetId.toNumb);
    },
  };
}

describe("AssetPaymentGateway", () => {
  it("charges by debiting the resolved default asset", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 100000" } });
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      amount: 25000,
      currency: "IDR",
      method: "cash",
    });

    expect(result.success).toBe(true);
    expect(result.gatewayRef).toMatch(/^asset:5\.1\./);
    expect(result.status).toBe("completed");
    expect(fake.store.get(1)?.balance).toBe("IDR 75000");
  });

  it("uses the passed assetId even if another asset is the default", async () => {
    const fake = createFakeAssets({
      1: { name: "MyCash", balance: "IDR 100000" },
      2: { name: "USD Wallet", balance: "USD 100" },
    });
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      assetId: 2,
      amount: 10,
      currency: "USD",
      method: "ewallet",
    });

    expect(result.success).toBe(true);
    expect(result.gatewayRef).toMatch(/^asset:5\.2\./);
    expect(fake.store.get(1)?.balance).toBe("IDR 100000");
    expect(fake.store.get(2)?.balance).toBe("USD 90");
  });

  it("resolves asset by currency match first", async () => {
    const fake = createFakeAssets({
      1: { name: "MyCash", balance: "IDR 100000" },
      2: { name: "USD Wallet", balance: "USD 100" },
    });
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      amount: 5,
      currency: "USD",
      method: "cash",
    });

    expect(result.success).toBe(true);
    expect(result.gatewayRef).toMatch(/^asset:5\.2\./);
    expect(fake.store.get(2)?.balance).toBe("USD 95");
  });

  it("fails when no payable asset exists", async () => {
    const fake = createFakeAssets({});
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      amount: 1000,
      currency: "IDR",
      method: "cash",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/no wallet asset/i);
  });

  it("fails on currency mismatch without mutating the asset", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 50000" } });
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      amount: 10,
      currency: "USD",
      method: "cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/currency mismatch/i);
    expect(fake.store.get(1)?.balance).toBe("IDR 50000");
  });

  it("fails on insufficient balance without mutating the asset", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 1000" } });
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      amount: 2000,
      currency: "IDR",
      method: "cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient/i);
    expect(fake.store.get(1)?.balance).toBe("IDR 1000");
  });

  it("fails on non-positive amount", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 1000" } });
    const gateway = new AssetPaymentGateway(fake);

    const result = await gateway.charge({
      userId: 5,
      amount: 0,
      currency: "IDR",
      method: "cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it("refunds by crediting the asset back", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 100000" } });
    const gateway = new AssetPaymentGateway(fake);

    const charged = await gateway.charge({
      userId: 5,
      amount: 30000,
      currency: "IDR",
      method: "cash",
    });
    expect(fake.store.get(1)?.balance).toBe("IDR 70000");

    const refund = await gateway.refund({
      gatewayRef: charged.gatewayRef,
      reason: "cancel",
    });

    expect(refund.success).toBe(true);
    expect(refund.status).toBe("completed");
    expect(fake.store.get(1)?.balance).toBe("IDR 100000");
  });

  it("refund supports a partial amount", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 100000" } });
    const gateway = new AssetPaymentGateway(fake);

    const charged = await gateway.charge({
      userId: 5,
      amount: 50000,
      currency: "IDR",
      method: "cash",
    });

    const refund = await gateway.refund({
      gatewayRef: charged.gatewayRef,
      amount: 10000,
    });

    expect(refund.success).toBe(true);
    expect(fake.store.get(1)?.balance).toBe("IDR 60000");
  });

  it("fails refund for an unknown gateway reference", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 100000" } });
    const gateway = new AssetPaymentGateway(fake);

    const refund = await gateway.refund({ gatewayRef: "not_asset_ref" });

    expect(refund.success).toBe(false);
    expect(refund.error).toMatch(/reference/i);
  });

  it("getStatus resolves the encoded reference", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 100000" } });
    const gateway = new AssetPaymentGateway(fake);

    const charged = await gateway.charge({
      userId: 5,
      amount: 1000,
      currency: "IDR",
      method: "cash",
    });

    const status = await gateway.getStatus(charged.gatewayRef);
    expect(status.status).toBe("completed");
    expect(status.raw?.assetId).toBe(1);
    expect(status.raw?.currency).toBe("IDR");
    expect(status.raw?.amount).toBe(1000);

    const garbage = await gateway.getStatus("not_an_asset_ref");
    expect(garbage.status).toBe("failed");
    expect(garbage.gatewayRef).toBe("not_an_asset_ref");
  });

  it("custom resolver is used over the default", async () => {
    const fake = createFakeAssets({ 1: { name: "MyCash", balance: "IDR 100000" } });
    let resolvedCurrency = "";
    const gateway = new AssetPaymentGateway(fake, {
      resolveAsset: (userId, currency) => {
        resolvedCurrency = currency;
        return Promise.resolve(1);
      },
    });

    const result = await gateway.charge({
      userId: 5,
      amount: 1000,
      currency: "IDR",
      method: "cash",
    });

    expect(resolvedCurrency).toBe("IDR");
    expect(result.success).toBe(true);
  });
});
