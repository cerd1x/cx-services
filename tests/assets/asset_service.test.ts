import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { NotFound } from "$services/shared/kernel/errors/service-error";
import { createAssetService, AssetService } from "$services/domain/assets";
import { createTransactionService } from "$services/domain/transactions";
import { Money, iso } from "@lib/money";
import { Asset } from "$services/domain/assets/core/model/asset.model";
import { ID } from "$services/shared/kernel";
import { mockAssetSwapGateway, InMemoryOutboxRepository } from "../utils/outbox.mock";

// `Money` punya constructor privat, jadi tipe `expect.any` tidak bisa menerima
// class-nya secara langsung.
const AnyMoney = Money as unknown as new (...args: any[]) => any;

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
          balance: Money.fromNumber(200000, iso.IDR),
        }),
      );

      const result = await AssetService.getInstance().createAsset({
        name: "BCA",
        type: "bank",
        userId: ID.new(1),
        balance: Money.fromNumber(200000, iso.IDR),
      });

      expect(result.name).toBe("BCA");
      expect(result.metadata.id).toBe("UkLWZg9DAJ");
      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "BCA",
          balance: expect.any(AnyMoney),
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
        NotFound,
      );
    });
  });

  describe("mutateAsset (CR)", () => {
    const mockAsset = {
      userId: ID.new(1),
      balance: Money.fromNumber(200, iso.USD),
      name: "Cash",
      type: "cash" as const,
      metadata: { id: "abc" },
    };

    it("adds balance and records a CR mutation", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await AssetService.getInstance().mutateAsset({
        userId: ID.new(1),
        code: "CR",
        assetId: ID.new(1),
        amount: Money.fromNumber(100, iso.USD),
      });

      expect(uow.run).toHaveBeenCalled();
      expect(assetRepo.findById).toHaveBeenCalledWith(ID.new(1), ID.new(1));
      expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
        ID.new(1),
        expect.objectContaining({
          type: "CR",
          amount: expect.any(AnyMoney),
          balanceBefore: expect.any(AnyMoney),
          balanceAfter: expect.any(AnyMoney),
        }),
        "tx",
      );
      expect(assetRepo.update).toHaveBeenCalledWith(
        ID.new(1),
        1,
        expect.objectContaining({
          balance: expect.any(AnyMoney),
        }),
        "tx",
      );
    });

    it("throws NotFoundError when asset not found", async () => {
      assetRepo.findById.mockResolvedValue(null);

      await expect(
        AssetService.getInstance().mutateAsset({
          userId: ID.new(1),
          code: "CR",
          assetId: ID.new(1),
          amount: Money.fromNumber(100, iso.USD),
        }),
      ).rejects.toThrow(NotFound);

      expect(assetRepo.update).not.toHaveBeenCalled();
      expect(assetRepo.createAssetMutation).not.toHaveBeenCalled();
    });
  });

  describe("mutateAsset (DB)", () => {
    const mockAsset = {
      userId: ID.new(1),
      balance: Money.fromNumber(200, iso.USD),
      name: "Cash",
      type: "cash" as const,
      metadata: { id: "abc" },
    };

    it("subtracts balance and records a DB mutation", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await AssetService.getInstance().mutateAsset({
        userId: ID.new(1),
        code: "DB",
        assetId: ID.new(1),
        amount: Money.fromNumber(50, iso.USD),
      });

      expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
        ID.new(1),
        expect.objectContaining({
          type: "DB",
          amount: expect.any(AnyMoney),
          balanceBefore: expect.any(AnyMoney),
          balanceAfter: expect.any(AnyMoney),
        }),
        "tx",
      );
    });

    it("throws NotFoundError when asset not found", async () => {
      assetRepo.findById.mockResolvedValue(null);

      await expect(
        AssetService.getInstance().mutateAsset({
          userId: ID.new(1),
          code: "DB",
          assetId: ID.new(1),
          amount: Money.fromNumber(100, iso.USD),
        }),
      ).rejects.toThrow(NotFound);
    });

    it("rejects when balance is insufficient", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await expect(
        AssetService.getInstance().mutateAsset({
          userId: ID.new(1),
          code: "DB",
          assetId: ID.new(1),
          amount: Money.fromNumber(500, iso.USD),
        }),
      ).rejects.toThrow(/insufficient/i);

      expect(assetRepo.update).not.toHaveBeenCalled();
      expect(assetRepo.createAssetMutation).not.toHaveBeenCalled();
    });
  });

  describe("mutateAsset (EB)", () => {
    const mockAsset = {
      userId: ID.new(1),
      balance: Money.fromNumber(200, iso.USD),
      name: "GoPay",
      type: "ewallet" as const,
      metadata: { id: "abc" },
    };

    it("uses EB code and records the given description", async () => {
      assetRepo.findById.mockResolvedValue(mockAsset);
      assetRepo.update.mockResolvedValue({} as any);
      assetRepo.createAssetMutation.mockResolvedValue({} as any);

      await AssetService.getInstance().mutateAsset({
        userId: ID.new(1),
        code: "EB",
        assetId: ID.new(1),
        amount: Money.fromNumber(30, iso.USD),
        description: "Pulsa topup",
      });

      expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
        ID.new(1),
        expect.objectContaining({
          type: "EB",
          amount: expect.any(AnyMoney),
          balanceBefore: expect.any(AnyMoney),
          balanceAfter: expect.any(AnyMoney),
          description: "Pulsa topup",
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
