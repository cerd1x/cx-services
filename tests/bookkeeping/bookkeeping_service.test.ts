import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { Money, iso } from "@lib/money";
import {
  BookkeepingService,
  createBookkeepingService,
  type BookkeepingTransactionData,
} from "$services/domain/bookkeeping";
import { ID } from "$services/shared/kernel";
import { ValidationError } from "$services/shared/kernel/errors/service-error";

function tx(
  id: number,
  data: {
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
    capital: Money.zero(data.amount.currency),
    ...data,
  };
}

describe("BookkeepingService", () => {
  const source = {
    listOrders: mock(),
    listFailedPayments: mock(),
  };

  const userId = ID.new(1);

  beforeAll(() => {
    createBookkeepingService({ source: source as never });
  });

  afterEach(() => {
    source.listOrders.mockClear();
    source.listFailedPayments.mockClear();
  });

  it("meneruskan batas bulan timezone ke sumber data", async () => {
    source.listOrders.mockResolvedValue([
      tx(1, {
        type: "income",
        amount: Money.fromNumber(100_000, iso.IDR),
        createdAt: new Date("2026-06-05T10:00:00.000Z"),
      }),
    ]);

    const ledger = await BookkeepingService.getInstance().getLedger({
      userId,
      month: "2026-06",
      timezoneOffsetMinutes: 420,
    });

    expect(source.listOrders).toHaveBeenCalledWith(
      userId,
      new Date("2026-05-31T17:00:00.000Z"),
      new Date("2026-06-30T17:00:00.000Z"),
    );
    expect(ledger.month).toBe("2026-06");
    expect(ledger.filter).toBe("all");
    expect(ledger.summaries[0]!.income.toNumber()).toBe(100_000);
  });

  it("meneruskan filter tipe transaksi", async () => {
    source.listOrders.mockResolvedValue([
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
    ]);

    const ledger = await BookkeepingService.getInstance().getLedger({
      userId,
      month: "2026-06",
      filter: "expense",
    });

    expect(ledger.filter).toBe("expense");
    expect(ledger.groups).toHaveLength(1);
    expect(ledger.groups[0]!.entries[0]!.transaction.id).toBe(2);
  });

  it("menolak bulan yang tidak valid", async () => {
    await expect(
      BookkeepingService.getInstance().getLedger({ userId, month: "2026-13" }),
    ).rejects.toThrow(ValidationError);
    expect(source.listOrders).not.toHaveBeenCalled();
  });

  it("mengambil payment gagal pada periode yang diminta", async () => {
    source.listFailedPayments.mockResolvedValue([
      {
        id: 7,
        amount: Money.fromNumber(100_000, iso.IDR),
        method: "cash",
        status: "failed",
        retryCount: 1,
        maxRetries: 3,
        createdAt: new Date("2026-06-05T10:00:00.000Z"),
      },
    ]);

    const result = await BookkeepingService.getInstance().getFailedPayments({
      userId,
      month: "2026-06",
    });

    expect(source.listFailedPayments).toHaveBeenCalledWith(
      userId,
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(result.totalCount).toBe(1);
    expect(result.retryableCount).toBe(1);
  });
});
