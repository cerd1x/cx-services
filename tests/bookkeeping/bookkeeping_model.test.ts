import { describe, expect, it } from "bun:test";
import { Money, iso } from "@lib/money";
import {
  BookkeepingFailedPayments,
  BookkeepingLedger,
  BookkeepingPeriod,
  type BookkeepingPaymentData,
  type BookkeepingTransactionData,
} from "$services/domain/bookkeeping";

function tx(
  id: number,
  overrides: Partial<BookkeepingTransactionData> & {
    type: BookkeepingTransactionData["type"];
    amount: Money;
    createdAt: Date;
  },
): BookkeepingTransactionData {
  return {
    id,
    status: "success",
    paymentStatus: "paid",
    paymentMethod: { type: "cash" },
    capital: Money.zero(overrides.amount.currency),
    ...overrides,
  };
}

function payment(
  id: number,
  data: { amount: number; createdAt: Date } & Partial<
    Omit<BookkeepingPaymentData, "amount" | "createdAt">
  >,
): BookkeepingPaymentData {
  const { amount, ...rest } = data;
  return {
    id,
    amount: Money.fromNumber(amount, iso.IDR),
    method: "cash",
    status: "failed",
    retryCount: 0,
    maxRetries: 3,
    ...rest,
  };
}

describe("BookkeepingPeriod", () => {
  it("menghitung batas bulan pada timezone pemanggil", () => {
    const period = BookkeepingPeriod.from({
      month: "2026-06",
      timezoneOffsetMinutes: 420,
    });

    expect(period.start.toISOString()).toBe("2026-05-31T17:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-06-30T17:00:00.000Z");
    expect(period.contains(new Date("2026-05-31T18:00:00.000Z"))).toBe(true);
    expect(period.contains(new Date("2026-06-30T17:00:00.000Z"))).toBe(false);
  });

  it("memakai tanggal kalender lokal untuk grouping", () => {
    const period = BookkeepingPeriod.from({
      month: "2026-06",
      timezoneOffsetMinutes: 420,
    });

    expect(period.localDateKey(new Date("2026-05-31T18:00:00.000Z"))).toBe("2026-06-01");
    expect(period.localDateKey(new Date("2026-06-30T16:59:59.000Z"))).toBe("2026-06-30");
  });

  it("menolak format bulan yang salah", () => {
    expect(() => BookkeepingPeriod.from({ month: "2026-13" })).toThrow("Month must use YYYY-MM");
    expect(() => BookkeepingPeriod.from({ month: "2026-6" })).toThrow("Month must use YYYY-MM");
  });
});

describe("BookkeepingLedger", () => {
  const period = BookkeepingPeriod.from({ month: "2026-06" });

  it("menghitung ringkasan, saldo berjalan, dan grup harian", () => {
    const ledger = BookkeepingLedger.build({
      period,
      filter: "all",
      transactions: [
        tx(1, {
          type: "income",
          amount: Money.fromNumber(100_000, iso.IDR),
          createdAt: new Date("2026-06-05T10:00:00.000Z"),
        }),
        tx(2, {
          type: "expense",
          amount: Money.fromNumber(40_000, iso.IDR),
          createdAt: new Date("2026-06-06T10:00:00.000Z"),
        }),
        tx(3, {
          type: "transfer",
          amount: Money.fromNumber(10_000, iso.IDR),
          createdAt: new Date("2026-06-07T10:00:00.000Z"),
        }),
      ],
    });

    expect(ledger.summaries).toHaveLength(1);
    expect(ledger.summaries[0]!.income.toNumber()).toBe(100_000);
    expect(ledger.summaries[0]!.expense.toNumber()).toBe(40_000);
    expect(ledger.summaries[0]!.profit.toNumber()).toBe(60_000);
    expect(ledger.summaries[0]!.transactionCount).toBe(3);

    // Grup dan baris terbaru dulu, saldo berjalan dihitung dari yang terlama.
    expect(ledger.groups.map((group) => group.date)).toEqual([
      "2026-06-07",
      "2026-06-06",
      "2026-06-05",
    ]);
    expect(ledger.groups[2]!.entries[0]!.runningBalance.toNumber()).toBe(100_000);
    expect(ledger.groups[1]!.entries[0]!.runningBalance.toNumber()).toBe(60_000);
    expect(ledger.groups[0]!.entries[0]!.runningBalance.toNumber()).toBe(60_000);
  });

  it("menyaring tipe sebelum menghitung saldo berjalan", () => {
    const ledger = BookkeepingLedger.build({
      period,
      filter: "expense",
      transactions: [
        tx(1, {
          type: "income",
          amount: Money.fromNumber(100_000, iso.IDR),
          createdAt: new Date("2026-06-05T10:00:00.000Z"),
        }),
        tx(2, {
          type: "expense",
          amount: Money.fromNumber(40_000, iso.IDR),
          createdAt: new Date("2026-06-06T10:00:00.000Z"),
        }),
      ],
    });

    expect(ledger.groups).toHaveLength(1);
    expect(ledger.groups[0]!.entries[0]!.transaction.type).toBe("expense");
    expect(ledger.groups[0]!.entries[0]!.runningBalance.toNumber()).toBe(-40_000);
    expect(ledger.summaries[0]!.income.toNumber()).toBe(0);
    expect(ledger.summaries[0]!.expense.toNumber()).toBe(40_000);
  });

  it("memisahkan ringkasan per mata uang", () => {
    const ledger = BookkeepingLedger.build({
      period,
      filter: "all",
      transactions: [
        tx(1, {
          type: "income",
          amount: Money.fromNumber(100_000, iso.IDR),
          createdAt: new Date("2026-06-05T10:00:00.000Z"),
        }),
        tx(2, {
          type: "income",
          amount: Money.fromNumber(50, iso.USD),
          createdAt: new Date("2026-06-06T10:00:00.000Z"),
        }),
      ],
    });

    expect(ledger.summaries.map((summary) => summary.currency)).toEqual(["IDR", "USD"]);
    expect(ledger.summaries[0]!.profit.toNumber()).toBe(100_000);
    expect(ledger.summaries[1]!.profit.toNumber()).toBe(50);
  });

  it("mengabaikan transaksi di luar periode", () => {
    const ledger = BookkeepingLedger.build({
      period,
      filter: "all",
      transactions: [
        tx(1, {
          type: "income",
          amount: Money.fromNumber(100_000, iso.IDR),
          createdAt: new Date("2026-05-31T23:59:59.000Z"),
        }),
      ],
    });

    expect(ledger.groups).toHaveLength(0);
    expect(ledger.summaries).toHaveLength(0);
  });
});

describe("BookkeepingFailedPayments", () => {
  const period = BookkeepingPeriod.from({ month: "2026-06" });

  it("menyaring bulan dan menghitung payment yang bisa di-retry", () => {
    const result = BookkeepingFailedPayments.build({
      period,
      payments: [
        payment(1, {
          amount: 100_000,
          createdAt: new Date("2026-06-05T10:00:00.000Z"),
          retryCount: 1,
          lastError: "Gateway timeout",
        }),
        payment(2, {
          amount: 50_000,
          createdAt: new Date("2026-06-06T10:00:00.000Z"),
          retryCount: 3,
        }),
        payment(3, {
          amount: 25_000,
          createdAt: new Date("2026-05-05T10:00:00.000Z"),
        }),
      ],
    });

    expect(result.totalCount).toBe(2);
    expect(result.retryableCount).toBe(1);
    expect(result.payments[0]!.id).toBe(2);
    expect(result.payments[0]!.lastError).toBeUndefined();
    expect(result.payments[1]!.lastError).toBe("Gateway timeout");
  });

  it("mengabaikan payment yang statusnya bukan failed", () => {
    const result = BookkeepingFailedPayments.build({
      period,
      payments: [
        payment(1, {
          amount: 100_000,
          createdAt: new Date("2026-06-05T10:00:00.000Z"),
          status: "completed",
        }),
      ],
    });

    expect(result.totalCount).toBe(0);
  });
});
