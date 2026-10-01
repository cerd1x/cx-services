import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type StatisticDto = {
  totalIncome: number;
  totalExpense: number;
  totalProfit: number;
  totalLoan: number;
  totalCash: number;
  totalAsset: number;
};

describe("statistic e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("returns zeroed statistics for a new user", async () => {
    const { session } = await signUpUser();

    const { data, errors } = await gql<{ statistics: StatisticDto }>(
      `{ statistics { totalIncome totalExpense totalProfit totalLoan totalCash totalAsset } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.statistics.totalIncome).toBe(0);
    expect(data!.statistics.totalExpense).toBe(0);
    expect(data!.statistics.totalProfit).toBe(0);
    expect(data!.statistics.totalLoan).toBe(0);
    expect(data!.statistics.totalCash).toBe(0);
    expect(data!.statistics.totalAsset).toBe(0);
  });

  it("reflects income after a transaction is created", async () => {
    const { session, user } = await signUpUser();

    const tx = await gql(
      `mutation($input: CreateTransactionInput!) {
        createTransaction(input: $input) { id }
      }`,
      {
        input: {
          type: "income",
          amount: "IDR 100000",
          capital: "IDR 60000",
          date: "2026-06-21T10:30:00.000Z",
          category: "Sales",
          customerId: user.id,
        },
      },
      authHeaders(session),
    );
    expect(tx.errors).toBeUndefined();

    const { data, errors } = await gql<{ statistics: StatisticDto }>(
      `{ statistics { totalIncome totalExpense totalProfit totalAsset } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.statistics.totalIncome).toBe(100000);
    expect(data!.statistics.totalExpense).toBe(0);
    expect(data!.statistics.totalProfit).toBe(40000);
  });
});