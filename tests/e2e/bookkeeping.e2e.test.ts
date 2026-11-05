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
        transaction: { id: string; type: string; amount: string; paymentStatus: string };
      }>;
    }>;
  };
};

describe("bookkeeping e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  async function createTransaction(
    session: string,
    user: { id: string },
    input: Record<string, unknown>,
  ) {
    const result = await gql(
      `mutation($input: CreateTransactionInput!) {
        createTransaction(input: $input) { id }
      }`,
      { input: { customerId: user.id, ...input } },
      authHeaders(session),
    );
    expect(result.errors).toBeUndefined();
    return result.data as { createTransaction: { id: string } };
  }

  it("mengembalikan ringkasan, grup harian, dan saldo berjalan", async () => {
    const { session, user } = await signUpUser();

    await createTransaction(session, user, {
      type: "income",
      amount: "IDR 100000",
      capital: "IDR 60000",
      date: "2026-06-05T10:00:00.000Z",
      category: "Sales",
    });
    await createTransaction(session, user, {
      type: "expense",
      amount: "IDR 40000",
      capital: "IDR 40000",
      date: "2026-06-06T10:00:00.000Z",
      category: "Operational",
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
      { input: { month: "2026-06", timezoneOffsetMinutes: 0 } },
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    const ledger = data!.bookkeepingLedger;
    expect(ledger.month).toBe("2026-06");
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

    // Terbaru dulu; saldo berjalan mengikuti urutan transaksi terlama.
    expect(ledger.groups.map((group) => group.date)).toEqual(["2026-06-06", "2026-06-05"]);
    expect(ledger.groups[0]!.entries[0]!.runningBalance).toBe("IDR 60000");
    expect(ledger.groups[1]!.entries[0]!.runningBalance).toBe("IDR 100000");
    expect(ledger.groups[0]!.entries[0]!.transaction.type).toBe("expense");
    expect(ledger.groups[1]!.entries[0]!.transaction.paymentStatus).toBe("unpaid");
  });

  it("menyaring ledger berdasarkan tipe transaksi", async () => {
    const { session, user } = await signUpUser();

    await createTransaction(session, user, {
      type: "income",
      amount: "IDR 100000",
      capital: "IDR 60000",
      date: "2026-06-05T10:00:00.000Z",
    });
    await createTransaction(session, user, {
      type: "expense",
      amount: "IDR 40000",
      capital: "IDR 40000",
      date: "2026-06-06T10:00:00.000Z",
    });

    const { data, errors } = await gql<LedgerDto>(
      `query($input: BookkeepingLedgerInput!) {
        bookkeepingLedger(input: $input) {
          filter
          summaries { currency income expense profit transactionCount }
          groups { entries { transaction { type } runningBalance } }
        }
      }`,
      { input: { month: "2026-06", filter: "expense" } },
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
