import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type TxDto = {
  id: string;
  type: string;
  status: string;
  amount: string;
  capital: string;
  category: string | null;
  customerId: string | null;
};

describe("transaction e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("creates, lists, queries and deletes an income transaction", async () => {
    const { session, user } = await signUpUser();
    const date = "2026-06-21T10:30:00.000Z";

    const create = await gql<{ createTransaction: TxDto }>(
      `mutation($input: CreateTransactionInput!) {
        createTransaction(input: $input) { id type status amount capital category customerId }
      }`,
      {
        input: {
          type: "income",
          amount: "IDR 50000",
          capital: "IDR 30000",
          date,
          category: "Sales",
          description: "Penjualan harian",
          customerId: user.id,
        },
      },
      authHeaders(session),
    );
    expect(create.errors).toBeUndefined();
    expect(create.data!.createTransaction.type).toBe("income");
    expect(create.data!.createTransaction.amount).toBe("IDR 50000");
    expect(create.data!.createTransaction.customerId).toBeTruthy();
    const txId = create.data!.createTransaction.id;

    const list = await gql<{ transactions: TxDto[] }>(
      `{ transactions { id type amount } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.errors).toBeUndefined();
    expect(list.data!.transactions.some((t) => t.id === txId)).toBe(true);

    const get = await gql<{ transaction: TxDto }>(
      `query($id: String!) { transaction(id: $id) { id type amount category } }`,
      { id: txId },
      authHeaders(session),
    );
    expect(get.errors).toBeUndefined();
    expect(get.data!.transaction.category).toBe("Sales");

    const byType = await gql<{ transactionsByType: TxDto[] }>(
      `query($type: TransactionType!) { transactionsByType(type: $type) { id type } }`,
      { type: "income" },
      authHeaders(session),
    );
    expect(byType.errors).toBeUndefined();
    expect(byType.data!.transactionsByType.every((t) => t.type === "income")).toBe(true);

    const byRange = await gql<{ transactionsByDateRange: TxDto[] }>(
      `query($start: DateTime!, $end: DateTime!) {
        transactionsByDateRange(start: $start, end: $end) { id }
      }`,
      { start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T23:59:59.000Z" },
      authHeaders(session),
    );
    expect(byRange.errors).toBeUndefined();
    expect(byRange.data!.transactionsByDateRange.some((t) => t.id === txId)).toBe(true);

    const update = await gql<{ updateTransaction: TxDto }>(
      `mutation($id: ID!, $input: UpdateTransactionInput!) {
        updateTransaction(id: $id, input: $input) { id category description }
      }`,
      { id: txId, input: { category: "Refunded Sales", customerId: user.id } },
      authHeaders(session),
    );
    expect(update.errors).toBeUndefined();
    expect(update.data!.updateTransaction.category).toBe("Refunded Sales");

    const del = await gql<{ deleteTransaction: boolean }>(
      `mutation($id: ID!) { deleteTransaction(id: $id) }`,
      { id: txId },
      authHeaders(session),
    );
    expect(del.errors).toBeUndefined();
    expect(del.data!.deleteTransaction).toBe(true);
  });

  it("swapBalance transfers funds between two assets", async () => {
    const { session } = await signUpUser();

    const { data } = await gql<{ createAsset: { id: string; name: string; balance: string } }>(
      `mutation($input: CreateAssetInput!) {
        createAsset(input: $input) { id name balance }
      }`,
      { input: { name: "Cash Wallet", type: "cash", balance: "IDR 1000000" } },
      authHeaders(session),
    );
    const { data: data2 } = await gql<{ createAsset: { id: string; name: string; balance: string } }>(
      `mutation($input: CreateAssetInput!) {
        createAsset(input: $input) { id name balance }
      }`,
      { input: { name: "Bank BCA", type: "bank", balance: "IDR 500000" } },
      authHeaders(session),
    );
    const fromAssetId = data!.createAsset.id;
    const toAssetId = data2!.createAsset.id;

    const swap = await gql<{
      swapBalance: {
        from: { id: string; balance: string };
        to: { id: string; balance: string };
      };
    }>(
      `mutation($fromAssetId: ID!, $toAssetId: ID!, $amount: String!) {
        swapBalance(fromAssetId: $fromAssetId, toAssetId: $toAssetId, amount: $amount) {
          from { id balance }
          to { id balance }
        }
      }`,
      { fromAssetId, toAssetId, amount: "IDR 250000" },
      authHeaders(session),
    );

    expect(swap.errors).toBeUndefined();
    expect(swap.data!.swapBalance.from.balance).toBe("IDR 750000");
    expect(swap.data!.swapBalance.to.balance).toBe("IDR 750000");

    const transfers = await gql<{ transactions: TxDto[] }>(
      `{ transactions { id type category amount } }`,
      undefined,
      authHeaders(session),
    );
    expect(
      transfers.data!.transactions.some((t) => t.type === "transfer" && t.category === "Move Balances"),
    ).toBe(true);
  });
});