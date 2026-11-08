import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type LedgerDto = {
  bookkeepingLedger: {
    month: string;
    filter: string;
    summaries: Array<{
      currency: string;
      income: string;
      expense: string;
      profit: string;
      transactionCount: number;
    }>;
    groups: Array<{
      date: string;
      transactionCount: number;
      entries: Array<{
        runningBalance: string;
        transaction: {
          id: string;
          type: string;
          amount: string;
          paymentStatus: string;
        };
      }>;
    }>;
  };
};

describe("bookkeeping e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  async function createProduct(
    session: string,
    input: { name: string; price: number; capital?: number; stock?: number },
  ) {
    const result = await gql(
      `mutation($input: CreateProductInput!) {
        createProduct(input: $input) { id }
      }`,
      { input: { stock: 10, ...input } },
      authHeaders(session),
    );
    expect(result.errors).toBeUndefined();
    return result.data as { createProduct: { id: string } };
  }

  async function createOrder(
    session: string,
    input: { type: "income" | "expense"; amount: string; capital?: string },
  ) {
    if (input.type === "income") {
      const product = await createProduct(session, {
        name: `Product ${Date.now()}_${Math.random()}`,
        price: Number(input.amount.replace(/\D/g, "")),
        capital: Number((input.capital ?? "0").replace(/\D/g, "")),
      });

      const result = await gql(
        `mutation($input: CreateOrderProductSaleInput!) {
          createOrderProductSale(input: $input) { id }
        }`,
        {
          input: {
            productId: product.createProduct.id,
            itemCount: 1,
            price: input.amount,
            paymentStatus: "unpaid",
            description: "Sales",
          },
        },
        authHeaders(session),
      );
      expect(result.errors).toBeUndefined();
      return result.data as { createOrderProductSale: { id: string } };
    }

    const result = await gql(
      `mutation($input: CreateOrderExpenseInput!) {
        createOrderExpense(input: $input) { id }
      }`,
      {
        input: {
          price: input.amount,
          itemCount: 1,
          paymentStatus: "unpaid",
          description: "Operational",
        },
      },
      authHeaders(session),
    );
    expect(result.errors).toBeUndefined();
    return result.data as { createOrderExpense: { id: string } };
  }

  it("mengembalikan ringkasan, grup harian, dan saldo berjalan", async () => {
    const { session } = await signUpUser();

    await createOrder(session, {
      type: "income",
      amount: "IDR 100000",
      capital: "IDR 60000",
    });
    await createOrder(session, {
      type: "expense",
      amount: "IDR 40000",
      capital: "IDR 40000",
    });

    const { data, errors } = await gql<LedgerDto>(
      `query($input: BookkeepingLedgerInput!) {
        bookkeepingLedger(input: $input) {
          month
          filter
          summaries { currency income expense profit transactionCount }
          groups {
            date
            transactionCount
            entries {
              runningBalance
              transaction { id type amount paymentStatus }
            }
          }
        }
      }`,
      { input: { month: "2026-11", timezoneOffsetMinutes: 0 } },
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    const ledger = data!.bookkeepingLedger;
    expect(ledger.month).toBe("2026-11");
    expect(ledger.filter).toBe("all");
    expect(ledger.summaries).toEqual([
      {
        currency: "IDR",
        income: "IDR 100000",
        expense: "IDR 40000",
        profit: "IDR 60000",
        transactionCount: 2,
      },
    ]);

    expect(ledger.groups).toHaveLength(1);
    expect(ledger.groups[0]!.date).toBe("2026-11-08");
    expect(ledger.groups[0]!.entries).toHaveLength(2);
    expect(ledger.groups[0]!.entries[0]!.runningBalance).toBe("IDR 60000");
    expect(ledger.groups[0]!.entries[1]!.runningBalance).toBe("IDR 100000");
    expect(ledger.groups[0]!.entries[0]!.transaction.type).toBe("expense");
    expect(ledger.groups[0]!.entries[1]!.transaction.paymentStatus).toBe(
      "unpaid",
    );
  });

  it("menyaring ledger berdasarkan tipe transaksi", async () => {
    const { session } = await signUpUser();

    await createOrder(session, {
      type: "income",
      amount: "IDR 100000",
      capital: "IDR 60000",
    });
    await createOrder(session, {
      type: "expense",
      amount: "IDR 40000",
      capital: "IDR 40000",
    });

    const { data, errors } = await gql<LedgerDto>(
      `query($input: BookkeepingLedgerInput!) {
        bookkeepingLedger(input: $input) {
          filter
          summaries { currency income expense profit transactionCount }
          groups { entries { transaction { type } runningBalance } }
        }
      }`,
      { input: { month: "2026-11", filter: "expense" } },
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    const ledger = data!.bookkeepingLedger;
    expect(ledger.filter).toBe("expense");
    expect(ledger.groups).toHaveLength(1);
    expect(ledger.groups[0]!.entries[0]!.transaction.type).toBe("expense");
    expect(ledger.groups[0]!.entries[0]!.runningBalance).toBe("IDR -40000");
    expect(ledger.summaries[0]).toEqual({
      currency: "IDR",
      income: "IDR 0",
      expense: "IDR 40000",
      profit: "IDR -40000",
      transactionCount: 1,
    });
  });

  it("menolak format bulan yang tidak valid", async () => {
    const { session } = await signUpUser();

    const { errors } = await gql(
      `query($input: BookkeepingLedgerInput!) {
        bookkeepingLedger(input: $input) { month }
      }`,
      { input: { month: "2026-13" } },
      authHeaders(session),
    );

    expect(errors?.[0]?.message).toContain("Month must use YYYY-MM format");
  });
});
