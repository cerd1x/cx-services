import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setDB, setD1 } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { createTransactionService, TransactionService } from "$services/domain/transactions";
import { TransactionRepositoryImpl } from "$services/domain/transactions/adapters/driven/drizzle/transaction.repository";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import { mockAssetSwapGateway } from "../utils/outbox.mock";
import { ID } from "$services/shared/kernel";

describe("Transaction integration", () => {
  let sqlite: any;
  let db: ReturnType<typeof drizzle>;
  let userId: number;

  beforeAll(() => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    db = drizzle(env.d1 as any);
    setDB(db as any);
    setD1(env.d1 as any);

    createTransactionService({
      txRepo: new TransactionRepositoryImpl(),
      assetGateway: mockAssetSwapGateway,
    });
  });

  afterAll(() => {
    sqlite?.close();
  });


  async function seedTransaction(overrides?: {
    type?: string;
    amount?: Balance;
    capital?: Balance;
    createdAt?: Date;
  }): Promise<number> {
    const tx = await TransactionService.getInstance().createTransaction({
      userId,
      type: (overrides?.type ?? "income") as "income" | "expense" | "transfer" | "outcome",
      amount: overrides?.amount ?? Balance.new("IDR 50000"),
      capital: overrides?.capital ?? Balance.new("IDR 30000"),
      createdAt: overrides?.createdAt,
      customerId: 1,
    });
    return tx.id!.toNumb;
  }

  let userSeq = 0;

  async function freshUser(): Promise<number> {
    userSeq++;
    const result = await db
      .insert(userTable)
      .values({
        name: `User ${userSeq}`,
        username: `tx_user_${Date.now()}_${userSeq}`,
        email: `tx_${userSeq}@test.com`,
        password: "hash",
      })
      .returning({ id: userTable.id });
    return result[0].id!;
  }

  it("creates transaction with DateTimeOrTimestamp (ISO string)", async () => {
    userId = await freshUser();
    const isoDate = "2026-06-21T10:30:00.000Z";
    const createdAtDate = new Date(isoDate);

    const tx = await TransactionService.getInstance().createTransaction({
      userId,
      type: "income",
      amount: Balance.new("IDR 50000"),
      capital: Balance.new("IDR 30000"),
      createdAt: createdAtDate,
      customerId: 1,
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe("income");
    expect(tx.createdAt?.toISOString()).toBe(isoDate);
  });

  it("creates transaction with DateTimeOrTimestamp (epoch timestamp)", async () => {
    userId = await freshUser();
    const epochDate = 1789852200;
    const createdAtDate = new Date(epochDate * 1000);

    const tx = await TransactionService.getInstance().createTransaction({
      userId,
      type: "expense",
      amount: Balance.new("USD 25000"),
      capital: Balance.new("USD 10000"),
      createdAt: createdAtDate,
      customerId: 1,
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe("expense");
    expect(tx.createdAt?.getTime()).toBe(epochDate * 1000);
  });

  it("creates transaction with cash type", async () => {
    userId = await freshUser();

    const tx = await TransactionService.getInstance().createTransaction({
      userId,
      type: "income",
      amount: Balance.new("IDR 100000"),
      capital: Balance.new("IDR 50000"),
      customerId: 1,
    });

    expect(tx.type).toBe("income");
    expect(tx.id).toBeDefined();
  });

  it("returns all transactions", async () => {
    userId = await freshUser();
    await seedTransaction();

    const all = await TransactionService.getInstance().transactions(ID.new(userId));

    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by type", async () => {
    userId = await freshUser();
    await seedTransaction({
      type: "income",
      amount: Balance.new("EUR 75000"),
      capital: Balance.new("EUR 30000"),
    });

    const filtered = await TransactionService.getInstance().transactionsByType(
      "income",
      ID.new(userId),
    );

    expect(filtered.length).toBeGreaterThanOrEqual(1);
    filtered.forEach((t) => expect(t.type).toBe("income"));
  });

  it("filters by date range", async () => {
    userId = await freshUser();
    await seedTransaction();

    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-12-31T23:59:59.000Z");

    const range = await TransactionService.getInstance().transactionsByDateRange(
      start,
      end,
      ID.new(userId),
    );

    expect(Array.isArray(range)).toBe(true);
  });
});
