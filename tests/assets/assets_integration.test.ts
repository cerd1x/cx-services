import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { createAssetService, AssetService } from "$services/domain/assets";
import { createUserService, UserService } from "$services/domain/user";
import { createTransactionService, TransactionService } from "$services/domain/transactions";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import { Asset } from "$services/domain/assets/adapters/driven/drizzle/asset.entity";
import { User } from "$services/domain/user/adapters/driven/drizzle/user.entity";
import { ID } from "$services/shared/kernel";
import { AssetRepository } from "$services/domain/assets/core/ports/out/asset-repository.port";
import { mockAssetSwapGateway, InMemoryOutboxRepository } from "../utils/outbox.mock";

describe("assets integrations", () => {
  let user1: User;
  let user2: User;
  let asset1: Asset;
  let asset2: Asset;

  const assetRepo = {
    save: mock(),
    findAll: mock(() => []),
    findByName: mock(() => null),
    findById: mock(),
    update: mock(),
    delete: mock(() => {}),
    createAssetMutation: mock(),
  };

  const userRepo = {
    save: mock(),
    isWithUsername: mock(),
    isWithUserId: mock(),
    findById: mock(),
    findAll: mock(),
    findByUsername: mock(),
    update: mock(),
    delete: mock(),
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

  const uow = {
    run: mock((fn: any) => fn("tx")),
  };

  beforeAll(() => {
    createTransactionService({ txRepo: mockTxRepo as any, assetGateway: mockAssetSwapGateway });
    createAssetService({
      assetRepo: assetRepo as unknown as AssetRepository,
      uow: uow as any,
      outboxRepo: new InMemoryOutboxRepository(),
    });
    createUserService({ userRepo: userRepo as any });
  });

  afterEach(() => {
    for (const m of Object.values(assetRepo)) (m as any).mockClear();
    for (const m of Object.values(userRepo)) (m as any).mockClear();
    for (const m of Object.values(mockTxRepo)) (m as any).mockClear();
    uow.run.mockClear();
  });

  it("full flow: create 2 users, each creates an asset, then mutate", async () => {
    // ---- 1. Create user 1 ----
    userRepo.isWithUsername.mockResolvedValueOnce(false);
    userRepo.save.mockImplementationOnce(async (u: User) => {
      u.id = ID.new(1);
      return u;
    });

    user1 = await UserService.getInstance().createUser(
      "Alice",
      "alice",
      "password123",
      "alice@test.com",
    );
    expect(user1.id?.toNumb).toBe(1);
    expect(user1.username).toBe("alice");

    // ---- 2. Create user 2 ----
    userRepo.isWithUsername.mockResolvedValueOnce(false);
    userRepo.save.mockImplementationOnce(async (u: User) => {
      u.id = ID.new(2);
      return u;
    });

    user2 = await UserService.getInstance().createUser("Bob", "bob", "password456", "bob@test.com");
    expect(user2.id?.toNumb).toBe(2);
    expect(user2.username).toBe("bob");

    // Verify both users were saved
    expect(userRepo.save).toHaveBeenCalledTimes(2);

    // ---- 3. User 1 creates an asset (bank account) ----
    const user1Id = user1.id!;
    assetRepo.save.mockImplementationOnce(async (input: any) => {
      return Asset.new({
        ...input,
        id: 1,
      });
    });

    asset1 = await AssetService.getInstance().createAsset({
      name: "Alice's Bank",
      type: "bank",
      userId: user1Id,
      balance: Balance.new("IDR 1000000"),
    });
    expect(asset1.name).toBe("Alice's Bank");
    expect(asset1.userId.toNumb).toBe(user1Id.toNumb);

    // ---- 4. User 2 creates an asset (ewallet) ----
    const user2Id = user2.id!;
    assetRepo.save.mockImplementationOnce(async (input: any) => {
      return Asset.new({
        ...input,
        id: 2,
      });
    });

    asset2 = await AssetService.getInstance().createAsset({
      name: "Bob's GoPay",
      type: "ewallet",
      userId: user2Id,
      balance: Balance.new("IDR 500000"),
    });
    expect(asset2.name).toBe("Bob's GoPay");
    expect(asset2.userId.toNumb).toBe(user2Id.toNumb);

    // ---- 5. User 1 subtracts balance from their asset ----
    assetRepo.findById.mockResolvedValueOnce({
      userId: user1Id,
      balance: "IDR 1000000",
      name: "Alice's Bank",
      type: "bank" as const,
      metadata: { id: "abc123" },
    });
    assetRepo.update.mockResolvedValueOnce({} as any);
    assetRepo.createAssetMutation.mockResolvedValueOnce({} as any);

    await AssetService.getInstance().mutateSubtractAsset(user1Id, ID.new(1), "IDR 200000");

    expect(uow.run).toHaveBeenCalled();
    expect(assetRepo.findById).toHaveBeenCalledWith(user1Id, ID.new(1));
    expect(assetRepo.createAssetMutation).toHaveBeenCalledWith(
      ID.new(1),
      expect.objectContaining({
        userId: user1Id,
        type: "subtract",
        amount: 200000,
        currency: "IDR",
        balanceBefore: "IDR 1000000",
      }),
      "tx",
    );
    expect(assetRepo.update).toHaveBeenCalledWith(
      user1Id,
      1,
      expect.objectContaining({ balance: expect.any(Balance) }),
      "tx",
    );
  });
});
