import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { createTransactionService, TransactionService } from "$services/domain/transactions";
import { Transaction } from "$services/domain/transactions/adapters/driven/drizzle/transaction.entity";
import { ID } from "$services/shared/kernel/id";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import { mockAssetSwapGateway } from "../utils/outbox.mock";

describe("TransactionService", () => {
  const txRepo = {
    save: mock(),
    findById: mock(),
    findAll: mock(),
    findByType: mock(),
    findByDateRange: mock(),
    update: mock(),
    delete: mock(),
  };

  const userId = ID.new(1);

  beforeAll(() => {
    createTransactionService({ txRepo: txRepo as any, assetGateway: mockAssetSwapGateway });
  });

  afterEach(() => {
    for (const m of Object.values(txRepo)) (m as any).mockClear();
  });

  const today = new Date("2026-06-11");
  const yesterday = new Date("2026-06-10");
  const tomorrow = new Date("2026-06-12");

  describe("createTransaction", () => {
    it("creates and saves an income transaction", async () => {
      txRepo.save.mockImplementation(async (t: Transaction) => {
        t.id = ID.new(1);
        return t;
      });

      const result = await TransactionService.getInstance().createTransaction({
        type: "income",
        amount: Balance.new("IDR 500000"),
        capital: Balance.new("IDR 300000"),
        createdAt: today,
        description: "Salary",
        category: "Work",
      });

      expect(result.id?.toNumb).toBe(1);
      expect(result.type).toBe("income");
      expect(result.amount?.value ?? result.amount).toBe(500000);
      expect(txRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: "income", amount: expect.anything() }),
      );
    });

    it("creates an expense transaction", async () => {
      txRepo.save.mockImplementation(async (t: Transaction) => {
        t.id = ID.new(2);
        return t;
      });

      const result = await TransactionService.getInstance().createTransaction({
        type: "expense",
        amount: Balance.new("IDR 25000"),
        capital: Balance.new("IDR 10000"),
        createdAt: today,
      });

      expect(result.type).toBe("expense");
    });

    it("throws when no id returned", async () => {
      txRepo.save.mockResolvedValue({} as any);

      await expect(
        TransactionService.getInstance().createTransaction({
          type: "income",
          amount: Balance.new("IDR 100"),
          capital: Balance.new("IDR 50"),
          createdAt: today,
        }),
      ).rejects.toThrow("Failed to create transaction: no id returned");
    });

    it("allows creation even with negative amount (no validation yet)", async () => {
      txRepo.save.mockImplementation(async (t: Transaction) => {
        t.id = ID.new(1);
        return t;
      });

      const result = await TransactionService.getInstance().createTransaction({
        type: "expense",
        amount: Balance.new("IDR -5000"),
        capital: Balance.new("IDR -2000"),
        createdAt: today,
      });

      expect(result.id?.toNumb).toBe(1);
      expect(txRepo.save).toHaveBeenCalled();
    });

    it("throws on invalid currency", () => {
      expect(() =>
        TransactionService.getInstance().createTransaction({
          type: "expense",
          amount: Balance.new("XYZ 10000"),
          capital: Balance.new("IDR 5000"),
          createdAt: today,
        }),
      ).toThrow("Currency must be a 3-letter code:");
    });
  });

  describe("transaction", () => {
    it("returns transaction when found", async () => {
      const t = Transaction.new({
        type: "income",
        amount: Balance.new("IDR 500000"),
        capital: Balance.new("IDR 300000"),
        createdAt: today,
      });
      t.id = ID.new(1);
      txRepo.findById.mockResolvedValue(t);

      const result = await TransactionService.getInstance().transaction(ID.new(1), userId);

      expect(result.id?.toNumb).toBe(1);
      expect((result.amount as any)?.value ?? result.amount).toBe(500000);
    });

    it("throws NotFoundError when not found", async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(
        TransactionService.getInstance().transaction(ID.new(999), userId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("transactions", () => {
    it("returns all transactions", async () => {
      const t1 = Transaction.new({
        type: "income",
        amount: Balance.new("IDR 500000"),
        capital: Balance.new("IDR 300000"),
        createdAt: today,
      });
      t1.id = ID.new(1);
      const t2 = Transaction.new({
        type: "expense",
        amount: Balance.new("IDR 25000"),
        capital: Balance.new("IDR 10000"),
        createdAt: today,
      });
      t2.id = ID.new(2);
      txRepo.findAll.mockResolvedValue([t1, t2]);

      const result = await TransactionService.getInstance().transactions(userId);

      expect(result).toHaveLength(2);
    });
  });

  describe("transactionsByType", () => {
    it("returns transactions filtered by type", async () => {
      const t = Transaction.new({
        type: "income",
        amount: Balance.new("IDR 500000"),
        capital: Balance.new("IDR 300000"),
        createdAt: today,
      });
      t.id = ID.new(1);
      txRepo.findByType.mockResolvedValue([t]);

      const result = await TransactionService.getInstance().transactionsByType("income", userId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("income");
      expect(txRepo.findByType).toHaveBeenCalledWith("income", userId);
    });
  });

  describe("transactionsByDateRange", () => {
    it("returns transactions within date range", async () => {
      const t = Transaction.new({
        type: "income",
        amount: Balance.new("IDR 500000"),
        capital: Balance.new("IDR 300000"),
        createdAt: today,
      });
      t.id = ID.new(1);
      txRepo.findByDateRange.mockResolvedValue([t]);

      const result = await TransactionService.getInstance().transactionsByDateRange(
        yesterday,
        tomorrow,
        userId,
      );

      expect(result).toHaveLength(1);
      expect(txRepo.findByDateRange).toHaveBeenCalledWith(yesterday, tomorrow, userId);
    });
  });

  describe("updateTransaction", () => {
    it("updates transaction fields", async () => {
      const existing = new Transaction({
        type: "income",
        amount: Balance.new("IDR 500000"),
        capital: Balance.new("IDR 300000"),
        createdAt: today,
      });
      existing.id = ID.new(1);
      txRepo.findById.mockResolvedValue(existing);
      txRepo.update.mockImplementation(async (t) => t);

      const result = await TransactionService.getInstance().updateTransaction(
        ID.new(1),
        {
          description: "Updated description",
        },
        userId,
      );

      expect(result.description).toBe("Updated description");
      expect(txRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Updated description" }),
        userId,
      );
    });

    it("throws NotFoundError when transaction not found", async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(
        TransactionService.getInstance().updateTransaction(
          ID.new(999),
          {
            description: "Ghost",
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundError);
      expect(txRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("requestFormId", () => {
    it("returns a password hash string", async () => {
      const result = await TransactionService.getInstance().requestFormTransaction(userId);
      expect(result).toMatch(/^\$pbkdf2-sha256\$\d+\$/);
    });

    it("returns different hashes on successive calls", async () => {
      const results = new Set(
        await Promise.all(
          Array.from({ length: 3 }, () =>
            TransactionService.getInstance().requestFormTransaction(userId),
          ),
        ),
      );
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("deleteTransaction", () => {
    it("deletes transaction by id", async () => {
      const existing = new Transaction({
        type: "expense",
        amount: Balance.new("IDR 25000"),
        capital: Balance.new("IDR 10000"),
        createdAt: today,
      });
      existing.id = ID.new(1);
      txRepo.findById.mockResolvedValue(existing);
      txRepo.delete.mockResolvedValue(undefined);

      await TransactionService.getInstance().deleteTransaction(ID.new(1), userId);

      expect(txRepo.delete).toHaveBeenCalledWith(1, userId);
    });

    it("throws NotFoundError when transaction to delete not found", async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(
        TransactionService.getInstance().deleteTransaction(ID.new(999), userId),
      ).rejects.toThrow(NotFoundError);
      expect(txRepo.delete).not.toHaveBeenCalled();
    });
  });
});
