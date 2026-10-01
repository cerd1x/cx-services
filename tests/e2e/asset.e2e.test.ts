import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type AssetDto = { id: string; name: string; type: string; balance: string };

describe("asset e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("full asset lifecycle: create, list, get, mutate, delete", async () => {
    const { session } = await signUpUser();

    const create = await gql<{ createAsset: AssetDto }>(
      `mutation($input: CreateAssetInput!) {
        createAsset(input: $input) { id name type balance }
      }`,
      { input: { name: "Bank BCA", type: "bank", balance: "IDR 1000000" } },
      authHeaders(session),
    );
    expect(create.errors).toBeUndefined();
    expect(create.data!.createAsset.name).toBe("Bank BCA");
    expect(create.data!.createAsset.balance).toBe("IDR 1000000");
    expect(create.data!.createAsset.id).toBeTruthy();
    const assetId = create.data!.createAsset.id;

    const list = await gql<{ assets: AssetDto[] }>(
      `{ assets { id name type balance } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.errors).toBeUndefined();
    expect(list.data!.assets.some((a) => a.name === "Bank BCA")).toBe(true);

    const byName = await gql<{ asset: AssetDto }>(
      `query($name: String!) { asset(name: $name) { id name type balance } }`,
      { name: "Bank BCA" },
      authHeaders(session),
    );
    expect(byName.errors).toBeUndefined();
    expect(byName.data!.asset.balance).toBe("IDR 1000000");

    const byId = await gql<{ assetById: AssetDto }>(
      `query($id: ID!) { assetById(id: $id) { id name balance } }`,
      { id: assetId },
      authHeaders(session),
    );
    expect(byId.errors).toBeUndefined();
    expect(byId.data!.assetById.id).toBe(assetId);

    const add = await gql<{ addBalance: AssetDto }>(
      `mutation($assetId: ID!, $amount: String!) {
        addBalance(assetId: $assetId, amount: $amount) { id balance }
      }`,
      { assetId, amount: "IDR 500000" },
      authHeaders(session),
    );
    expect(add.errors).toBeUndefined();
    expect(add.data!.addBalance.balance).toBe("IDR 1500000");

    const subtract = await gql<{ subtractBalance: AssetDto }>(
      `mutation($assetId: ID!, $amount: String!) {
        subtractBalance(assetId: $assetId, amount: $amount) { id balance }
      }`,
      { assetId, amount: "IDR 200000" },
      authHeaders(session),
    );
    expect(subtract.errors).toBeUndefined();
    expect(subtract.data!.subtractBalance.balance).toBe("IDR 1300000");

    const mutations = await gql<{
      assetMutations: Array<{ id: string; type: string; amount: number; balanceBefore: string; balanceAfter: string }>;
    }>(
      `query($assetId: ID!) { assetMutations(assetId: $assetId) { id type amount balanceBefore balanceAfter } }`,
      { assetId },
      authHeaders(session),
    );
    expect(mutations.errors).toBeUndefined();
    expect(mutations.data!.assetMutations.length).toBeGreaterThanOrEqual(2);
    expect(mutations.data!.assetMutations.some((m) => m.type === "add")).toBe(true);
    expect(mutations.data!.assetMutations.some((m) => m.type === "subtract")).toBe(true);

    const del = await gql<{ deleteAsset: boolean }>(
      `mutation($name: String!) { deleteAsset(name: $name) }`,
      { name: "Bank BCA" },
      authHeaders(session),
    );
    expect(del.errors).toBeUndefined();
    expect(del.data!.deleteAsset).toBe(true);

    const afterDelete = await gql<{ assets: AssetDto[] }>(
      `{ assets { id name } }`,
      undefined,
      authHeaders(session),
    );
    expect(afterDelete.data!.assets.some((a) => a.name === "Bank BCA")).toBe(false);
  });
});