import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { createAssetService, AssetService } from "$services/domain/assets";
import { createTransactionService, TransactionService } from "$services/domain/transactions";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import { Asset } from "$services/domain/assets/core/model/asset.model";
import { ID } from "$services/shared/kernel";
import { mockAssetSwapGateway, InMemoryOutboxRepository } from "../utils/outbox.mock";

describe("AssetService", () => {
  const assetRepo = {
    save: mock(),
    findAll: mock(),
    findByName: mock(),
    findById: mock(),
    update: mock(),
    delete: mock(),
    createAssetMutation: mock(),
    findMutationsByAssetId: mock(),
  };

  const uow = {
    run: mock((fn: any) => fn("tx")),
  };

  const mockTxRepo = {
    save: mock(async (t: any) => {
      t.id = ID.new(1);
      return t;
    }),
    findById: mock(),
    findAll: mock(),
    findByType: mock(),
    findByDateRange: mock(),
    update: mock(),
    delete: mock(),
  };

  beforeAll(() => {
    createTransactionService({ txRepo: mockTxRepo as any, assetGateway: mockAssetSwapGateway });
    createAssetService({
      assetRepo: assetRepo as any,
      uow: uow as any,
      outboxRepo: new InMemoryOutboxRepository(),
    });
  });

  afterEach(() => {
    for (const m of Object.values(assetRepo)) (m as any).mockClear();
    uow.run.mockClear();
  });

  describe("createAsset", () => {
    it("creates and saves an asset", async () => {
      assetRepo.save.mockResolvedValue(
        Asset.new({
          id: 1,
          name: "BCA",
          type: "bank",
          userId: ID.new(1),
          balance: Balance.new("IDR 200.000"),
        }),
      );

      const result = await AssetService.getInstance().createAsset({
        name: "BCA",
        type: "bank",
        userId: ID.new(1),
        balance: Balance.new("IDR 200.000"),
      });

      expect(result.name).toBe("BCA");
      expect(result.metadata.id).toBe("UkLWZg9DAJ");
      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "BCA",
          balance: Balance.new("IDR 200.000"),
          type: "bank",
        }),
      );
    });
  });

  describe("assets", () => {
    it("returns all assets for the user", async () => {
      assetRepo.findAll.mockResolvedValue([
        { name: "BCA", type: "bank", currency: "idr", balance: 5000 },
        { name: "GoPay", type: "ewallet", currency: "idr", balance: 200 },
      ]);

      const result = await AssetService.getInstance().assets(ID.new(1));

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("BCA");
      expect(result[1].name).toBe("GoPay");
      expect(assetRepo.findAll).toHaveBeenCalledWith(ID.new(1));
    });
  });

  describe("assetByName", () => {
    it("returns asset when found", async () => {
      assetRepo.findByName.mockResolvedValue({
        name: "BCA",
        type: "bank",
        currency: "idr",
        balance: 5000,
      });

      const result = await AssetService.getInstance().assetByName("BCA", ID.new(1));

      expect(result.name).toBe("BCA");
      expect(assetRepo.findByName).toHaveBeenCalledWith("BCA", ID.new(1));
    });

    it("throws NotFoundError when not found", async () => {
      assetRepo.findByName.mockResolvedValue(null);

      await expect(AssetService.getInstance().assetByName("Unknown", ID.new(1))).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("mutateAddAsset", () => {
    const mockAsset = {
      userId: ID.new(1),
      balance: "USD 200",
      name: "Cash",
      type: "cash" as const,
      metadata: { id: "abc" },
    };

    it("adds balance and records mutation", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await AssetService.getInstance().mutateAddAsset(ID.new(1), ID.new(1), "USD 100");

      expect(uow.run).toHaveBeenCalled();
      expect(assetRepo.findById).toHaveBeenCalledWith(ID.new(1), ID.new(1));
      expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
        ID.new(1),
        expect.objectContaining({
          type: "add",
          amount: 100,
          currency: "USD",
          balanceBefore: "USD 200",
          balanceAfter: "USD 300",
        }),
        "tx",
      );
      expect(assetRepo.update).toHaveBeenCalledWith(
        ID.new(1),
        1,
        expect.objectContaining({
          balance: expect.any(Balance),
        }),
        "tx",
      );
    });

    it("throws NotFoundError when asset not found", async () => {
      assetRepo.findById.mockResolvedValue(null);

      await expect(
        AssetService.getInstance().mutateAddAsset(ID.new(1), ID.new(1), "USD 100"),
      ).rejects.toThrow(NotFoundError);

      expect(assetRepo.update).not.toHaveBeenCalled();
      expect(assetRepo.createAssetMutation).not.toHaveBeenCalled();
    });
  });

  describe("mutateSubtractAsset", () => {
    const mockAsset = {
      userId: ID.new(1),
      balance: "USD 200",
      name: "Cash",
      type: "cash" as const,
      metadata: { id: "abc" },
    };

    it("subtracts balance and records mutation", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await AssetService.getInstance().mutateSubtractAsset(ID.new(1), ID.new(1), "USD 50");

      expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
        ID.new(1),
        expect.objectContaining({
          type: "subtract",
          balanceBefore: "USD 200",
          balanceAfter: "USD 150",
        }),
        "tx",
      );
    });

    it("throws NotFoundError when asset not found", async () => {
      assetRepo.findById.mockResolvedValue(null);

      await expect(
        AssetService.getInstance().mutateSubtractAsset(ID.new(1), ID.new(1), "USD 100"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("mutateTransactionAsset", () => {
    const mockAsset = {
      userId: ID.new(1),
      balance: "USD 200",
      name: "Cash",
      type: "cash" as const,
      metadata: { id: "abc" },
    };

    it("uses transaction type and records mutation", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await AssetService.getInstance().mutateTransactionAsset(
        ID.new(1),
        ID.new(1),
        "USD 30",
        "Transfer out",
      );

      expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
        ID.new(1),
        expect.objectContaining({
          type: "transaction",
          balanceBefore: "USD 200",
          balanceAfter: "USD 170",
          description: "Transfer out",
        }),
        "tx",
      );
    });
  });

  describe("deleteAsset", () => {
    it("deletes by name for the user", async () => {
      await AssetService.getInstance().deleteAsset("BCA", ID.new(1));

      expect(assetRepo.delete).toHaveBeenCalledWith("BCA", ID.new(1));
    });
  });
});
