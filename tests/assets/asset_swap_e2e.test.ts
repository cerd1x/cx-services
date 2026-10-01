import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { createAssetService, AssetService } from "$services/domain/assets";
import { createTransactionService, TransactionService } from "$services/domain/transactions";
import { Balance } from "$services/domain/assets/core/value-objects/balance.vo";
import {
  Asset,
  type AssetData,
  type AssetType,
  type AssetUpdate,
} from "$services/domain/assets/core/model/asset.model";
import type {
  AssetMutationData,
  AssetMutationInput,
} from "$services/domain/assets/core/model/asset-mutation.model";
import { AssetRepository } from "$services/domain/assets/core/ports/out/asset-repository.port";
import { OutboxRepository } from "$services/shared/kernel/outbox/outbox-repository.port";
import { EventBus } from "$services/shared/kernel/outbox/event-bus";
import type { UnitOfWork } from "$services/shared/kernel/uow.port";
import { ID } from "$services/shared/kernel";
import { NotFoundError } from "$services/shared/kernel/errors/service-error";

type AssetRow = {
  id: number;
  userId: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
};

type MutationRow = {
  id: number;
  assetId: number;
  userId: number;
  type: "add" | "subtract" | "transaction" | "swap";
  amount: number;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
};

class InMemoryAssetRepository extends AssetRepository {
  assets: AssetRow[] = [];
  mutations: MutationRow[] = [];
  #assetSeq = 1;
  #mutationSeq = 1;

  #toEntity(row: AssetRow): Asset {
    return Asset.new({
      id: row.id,
      userId: ID.new(row.userId),
      name: row.name,
      type: row.type as AssetType,
      balance: Balance.new(`${row.currency} ${row.balance}`),
    });
  }

  async save(asset: AssetData & { balance: Balance }): Promise<Asset | null> {
    const row: AssetRow = {
      id: this.#assetSeq++,
      userId: asset.userId.toNumb,
      name: asset.name,
      type: asset.type,
      balance: asset.balance.value,
      currency: asset.balance.code,
    };
    this.assets.push(row);
    return this.#toEntity(row);
  }

  async findAll(userId: ID): Promise<Asset[]> {
    return this.assets.filter((r) => r.userId === userId.toNumb).map((r) => this.#toEntity(r));
  }

  async findByName(name: string, userId: ID): Promise<Asset | null> {
    const row = this.assets.find((r) => r.name === name && r.userId === userId.toNumb);
    return row ? this.#toEntity(row) : null;
  }

  async findById(userId: ID, assetId: ID): Promise<Asset | null> {
    const row = this.assets.find((r) => r.id === assetId.toNumb && r.userId === userId.toNumb);
    return row ? this.#toEntity(row) : null;
  }

  async update(userId: ID, id: number, data: AssetUpdate): Promise<Asset> {
    const row = this.assets.find((r) => r.id === id && r.userId === userId.toNumb);
    if (!row) throw new Error("Asset not found");

    if (data.name !== undefined) row.name = data.name;
    if (data.type !== undefined) row.type = data.type;
    if (data.balance !== undefined) {
      row.balance = data.balance.value;
      row.currency = data.balance.code;
    }
    return this.#toEntity(row);
  }

  async delete(name: string, userId: ID): Promise<void> {
    this.assets = this.assets.filter((r) => !(r.name === name && r.userId === userId.toNumb));
  }

  async createAssetMutation(assetId: ID, data: AssetMutationInput): Promise<AssetMutationData> {
    const row: MutationRow = {
      id: this.#mutationSeq++,
      assetId: assetId.toNumb,
      userId: data.userId.toNumb,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      balanceBefore: data.balanceBefore,
      balanceAfter: data.balanceAfter,
      description: data.description ?? null,
      createdAt: new Date().toISOString(),
    };
    this.mutations.push(row);
    return { ...row, userId: ID.new(row.userId) };
  }

  async findMutationsByAssetId(assetId: ID, userId: ID): Promise<AssetMutationData[]> {
    return this.mutations
      .filter((m) => m.assetId === assetId.toNumb && m.userId === userId.toNumb)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ ...m, userId: ID.new(m.userId) }));
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  async run<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return fn("in-memory-tx");
  }
}

type OutboxRow = {
  id: number;
  correlationId: string;
  eventType: string;
  payload: string;
  processed: boolean;
};

class InMemoryOutboxRepository extends OutboxRepository {
  rows: OutboxRow[] = [];
  #seq = 1;

  async save(event: { correlationId: string; eventType: string; payload: string }): Promise<void> {
    this.rows.push({
      id: this.#seq++,
      correlationId: event.correlationId,
      eventType: event.eventType,
      payload: event.payload,
      processed: false,
    });
  }

  async findUnprocessed(): Promise<
    { id: number; correlationId: string; eventType: string; payload: string }[]
  > {
    return this.rows.filter((r) => !r.processed);
  }

  async markProcessed(ids: number[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.find((r) => r.id === id);
      if (row) row.processed = true;
    }
  }

  async markProcessedByCorrelation(correlationId: string): Promise<void> {
    for (const row of this.rows) {
      if (row.correlationId === correlationId) row.processed = true;
    }
  }
}

describe("swapBalance e2e (in-memory repo)", () => {
  let repo: InMemoryAssetRepository;
  let outboxRepo: InMemoryOutboxRepository;
  const userId = ID.new(1);

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
    repo = new InMemoryAssetRepository();
    outboxRepo = new InMemoryOutboxRepository();
    createAssetService({ assetRepo: repo, uow: new InMemoryUnitOfWork(), outboxRepo });
    const txService = createTransactionService({
      txRepo: mockTxRepo as any,
      assetGateway: AssetService.getInstance(),
    });

    EventBus.on("asset.swapped", async (payload) => {
      const { userId, fromAssetId, toAssetId, amount, currency, fromAssetName, toAssetName } =
        payload;
      await txService.createTransaction({
        userId: Number(userId),
        payWithAssetId: Number(fromAssetId),
        payToAssetId: Number(toAssetId),
        amount: Balance.new(`${currency} ${amount}`),
        capital: Balance.zero(),
        type: "transfer",
        category: "Move Balances",
        description: `Swap ( ${fromAssetName} to ${toAssetName} )`,
        status: "success",
      });
    });
  });

  beforeEach(() => {
    repo = new InMemoryAssetRepository();
    outboxRepo = new InMemoryOutboxRepository();
    createAssetService({ assetRepo: repo, uow: new InMemoryUnitOfWork(), outboxRepo });
    createTransactionService({
      txRepo: mockTxRepo as any,
      assetGateway: AssetService.getInstance(),
    });
    for (const m of Object.values(mockTxRepo)) (m as any).mockClear();
  });

  async function seed(): Promise<{ walletId: ID; bankId: ID }> {
    const wallet = await AssetService.getInstance().createAsset({
      name: "Wallet",
      type: "cash",
      userId,
      balance: Balance.new("IDR 1000000"),
    });
    const bank = await AssetService.getInstance().createAsset({
      name: "Bank",
      type: "bank",
      userId,
      balance: Balance.new("IDR 500000"),
    });
    return { walletId: ID.new(wallet.metadata.id ? 1 : 1), bankId: ID.new(2) };
  }

  it("swaps balance and records type swap on both assets", async () => {
    const { walletId, bankId } = await seed();

    const result = await TransactionService.getInstance().swapBalance(
      userId,
      walletId,
      bankId,
      "IDR 250000",
    );

    expect(result.from.balance).toBe("IDR 750000");
    expect(result.to.balance).toBe("IDR 750000");

    const fromAsset = await AssetService.getInstance().assetById(userId, walletId);
    const toAsset = await AssetService.getInstance().assetById(userId, bankId);
    expect(fromAsset?.balance).toBe("IDR 750000");
    expect(toAsset?.balance).toBe("IDR 750000");

    const fromMutations = await AssetService.getInstance().assetMutations(userId, walletId);
    expect(fromMutations).toHaveLength(1);
    expect(fromMutations[0].type).toBe("swap");
    expect(fromMutations[0].amount).toBe(250000);
    expect(fromMutations[0].currency).toBe("IDR");
    expect(fromMutations[0].balanceBefore).toBe("IDR 1000000");
    expect(fromMutations[0].balanceAfter).toBe("IDR 750000");
    expect(fromMutations[0].description).toBe("Swap To Bank");

    const toMutations = await AssetService.getInstance().assetMutations(userId, bankId);
    expect(toMutations).toHaveLength(1);
    expect(toMutations[0].type).toBe("swap");
    expect(toMutations[0].balanceBefore).toBe("IDR 500000");
    expect(toMutations[0].balanceAfter).toBe("IDR 750000");
    expect(toMutations[0].description).toBe("Swap From Wallet");

    expect(mockTxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "transfer",
        category: "Move Balances",
      }),
    );

    expect(outboxRepo.rows).toHaveLength(1);
    expect(outboxRepo.rows[0].eventType).toBe("asset.swapped");
    expect(outboxRepo.rows[0].correlationId).toMatch(/^swap-1-/);
    expect(outboxRepo.rows[0].processed).toBe(true);
    const outboxPayload = JSON.parse(outboxRepo.rows[0].payload);
    expect(outboxPayload).toMatchObject({
      userId: 1,
      amount: 250000,
      currency: "IDR",
      fromAssetName: "Wallet",
      toAssetName: "Bank",
    });
  });

  it("rejects when source asset not found and records nothing", async () => {
    const { bankId } = await seed();

    await expect(
      TransactionService.getInstance().swapBalance(userId, ID.new(99), bankId, "IDR 100000"),
    ).rejects.toThrow(NotFoundError);

    expect(repo.mutations).toHaveLength(0);
    const bank = await AssetService.getInstance().assetById(userId, bankId);
    expect(bank?.balance).toBe("IDR 500000");
  });

  it("rejects when destination asset not found and records nothing", async () => {
    const { walletId } = await seed();

    await expect(
      TransactionService.getInstance().swapBalance(userId, walletId, ID.new(99), "IDR 100000"),
    ).rejects.toThrow(NotFoundError);

    expect(repo.mutations).toHaveLength(0);
    const wallet = await AssetService.getInstance().assetById(userId, walletId);
    expect(wallet?.balance).toBe("IDR 1000000");
  });
});
