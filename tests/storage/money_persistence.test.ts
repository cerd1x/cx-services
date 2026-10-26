import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setDB, setD1 } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { assetTable } from "$services/shared/infra/db/drizzle-schema/asset.schema";
import { assetMutationTable } from "$services/shared/infra/db/drizzle-schema/asset_mutation.schema";
import { transactionTable } from "$services/shared/infra/db/drizzle-schema/transaction.schema";
import { AssetRepositoryImpl } from "$services/domain/assets/adapters/driven/drizzle/asset.repository";
import { TransactionRepositoryImpl } from "$services/domain/transactions/adapters/driven/drizzle/transaction.repository";
import { Transaction } from "$services/domain/transactions/core/model/transaction.model";
import { Money, iso } from "@lib/money";
import {
  deserializeMoney,
  fromMinorUnits,
  serializeMoney,
  toMinorUnits,
} from "$services/shared/infra/db/money";
import { ID } from "$services/shared/kernel";

describe("money di database", () => {
  let sqlite: any;
  let db: ReturnType<typeof drizzle>;
  let userId: number;

  beforeAll(async () => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    db = drizzle(env.d1 as any);
    setDB(db as any);
    setD1(env.d1 as any);

    const result = await db
      .insert(userTable)
      .values({
        name: "Money Tester",
        username: `money_${Date.now()}`,
        email: `money_${Date.now()}@test.com`,
        password: "hash",
      })
      .returning({ id: userTable.id });
    userId = result[0].id!;
  });

  afterAll(() => {
    sqlite?.close();
  });

  describe("helper minor unit", () => {
    it("mengikuti exponent mata uang", () => {
      expect(toMinorUnits(Money.fromNumber(1500000, iso.IDR))).toBe(150000000n);
      expect(toMinorUnits(Money.fromNumber(100.5, iso.USD))).toBe(10050n);
      expect(toMinorUnits(Money.fromNumber(100, iso.JPY))).toBe(100n);
    });

    it("membulatkan sisa presisi ke satuan terkecil", () => {
      expect(toMinorUnits(Money.fromNumber(100.555, iso.USD))).toBe(10056n);
    });

    it("mengembalikan nilai major unit", () => {
      expect(fromMinorUnits(150000000, "IDR").toNumber()).toBe(1500000);
      expect(fromMinorUnits(10050, "USD").toNumber()).toBe(100.5);
      expect(fromMinorUnits(10050n, "USD").currency.code).toBe("USD");
    });

    it("menolak kode mata uang yang tidak dikenal", () => {
      expect(() => fromMinorUnits(100, "XYZ")).toThrow("Unknown currency: XYZ");
    });
  });

  describe("helper string Money", () => {
    it("menyimpan instance Money sebagai string \"KODE NOMINAL\"", () => {
      expect(serializeMoney(Money.fromNumber(100.5, iso.USD))).toBe("USD 100.5");
      expect(serializeMoney(Money.fromNumber(1500000, iso.IDR))).toBe("IDR 1500000");
    });

    it("membaca kembali string Money menjadi instance Money", () => {
      const money = deserializeMoney("IDR 1500000");

      expect(money).toBeInstanceOf(Money);
      expect(money.currency.code).toBe("IDR");
      expect(money.toNumber()).toBe(1500000);
    });

    it("membaca nominal desimal dengan presisi penuh", () => {
      expect(deserializeMoney("USD 100.5").toNumber()).toBe(100.5);
      expect(deserializeMoney("USD 100").toNumber()).toBe(100);
    });

    it("round-trip mempertahankan nilai", () => {
      const original = Money.fromNumber(99.99, iso.USD);
      const restored = deserializeMoney(serializeMoney(original));

      expect(restored.toMinorUnits()).toBe(original.toMinorUnits());
    });

    it("menolak isi kolom yang bukan string Money", () => {
      expect(() => deserializeMoney("IDR1500000")).toThrow();
    });
  });

  describe("AssetRepositoryImpl", () => {
    it("menyimpan saldo sebagai minor unit dan membaca kembali sebagai Money", async () => {
      const repo = new AssetRepositoryImpl();

      const saved = await repo.save({
        userId: ID.new(userId),
        name: "Tabungan",
        type: "bank",
        balance: Money.fromNumber(1500000, iso.IDR),
      });

      expect(saved?.balance.toNumber()).toBe(1500000);

      const row = await db
        .select()
        .from(assetTable)
        .where(eq(assetTable.id, ID.new(saved!.IdStr).toNumb))
        .limit(1);

      expect(row[0].balance).toBe(150000000);
      expect(row[0].currency).toBe("IDR");

      const found = await repo.findById(ID.new(userId), ID.new(ID.new(saved!.IdStr).toNumb));
      expect(found?.balance.toNumber()).toBe(1500000);
    });

    it("menyimpan mutasi dalam minor unit", async () => {
      const repo = new AssetRepositoryImpl();

      const saved = await repo.save({
        userId: ID.new(userId),
        name: "Dolar",
        type: "bank",
        balance: Money.fromNumber(100, iso.USD),
      });

      const mutation = await repo.createAssetMutation(ID.new(ID.new(saved!.IdStr).toNumb), {
        userId: ID.new(userId),
        assetId: ID.new(saved!.IdStr).toNumb,
        type: "add",
        amount: Money.fromNumber(25.5, iso.USD),
        balanceBefore: Money.fromNumber(100, iso.USD),
        balanceAfter: Money.fromNumber(125.5, iso.USD),
      });

      expect(mutation.amount.toNumber()).toBe(25.5);
      expect(mutation.amount.currency.code).toBe("USD");

      const row = await db.select().from(assetMutationTable).limit(1);
      expect(row[0]).toMatchObject({
        amount: 2550,
        balanceBefore: 10000,
        balanceAfter: 12550,
        currency: "USD",
      });

      const mutations = await repo.findMutationsByAssetId(
        ID.new(ID.new(saved!.IdStr).toNumb),
        ID.new(userId),
      );
      expect(mutations).toHaveLength(1);
      expect(mutations[0].amount.toNumber()).toBe(25.5);
      expect(mutations[0].balanceBefore.toNumber()).toBe(100);
      expect(mutations[0].balanceAfter.toNumber()).toBe(125.5);
    });
  });

  describe("TransactionRepositoryImpl", () => {
    it("menyimpan amount/capital sebagai string Money", async () => {
      const repo = new TransactionRepositoryImpl();

      const saved = await repo.save(
        Transaction.new({
          userId,
          type: "income",
          amount: Money.fromNumber(1500000, iso.IDR),
          capital: Money.fromNumber(500000, iso.IDR),
          createdAt: new Date("2026-06-21T10:30:00.000Z"),
        }),
      );

      expect(saved.amount.toNumber()).toBe(1500000);

      const row = await db
        .select()
        .from(transactionTable)
        .where(eq(transactionTable.id, saved.id!.toNumb))
        .limit(1);

      expect(row[0].amount).toBe("IDR 1500000");
      expect(row[0].capital).toBe("IDR 500000");

      const found = await repo.findById(saved.id!.toNumb, ID.new(userId));
      expect(found?.amount.toNumber()).toBe(1500000);
      expect(found?.capital.toNumber()).toBe(500000);
      expect(found?.amount.currency.code).toBe("IDR");
    });
  });
});
