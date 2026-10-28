import { Asset, type AssetInput } from "./core/model/asset.model";
import type { Money } from "@lib/money";
import { type AssetMutationData } from "./core/model/asset-mutation.model";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ID } from "$services/shared/kernel";
import { CreateAssetUseCase } from "./core/usecase/create_asset.usecase";
import { CreateDefaultAssetCashUseCase } from "./core/usecase/create_default_asset_cash.usecase";
import { ListAssetsUseCase } from "./core/usecase/list_assets.usecase";
import { AssetByNameUseCase } from "./core/usecase/asset_by_name.usecase";
import { AssetByIdUseCase } from "./core/usecase/asset_by_id.usecase";
import { UpdateAssetUseCase } from "./core/usecase/update_asset.usecase";
import { ApplyAssetMutationUseCase } from "./core/usecase/apply_asset_mutation.usecase";
import {
  MutateAssetUseCase,
  type MutateAssetInput,
  type MutateAssetResult,
} from "./core/usecase/mutate_asset.usecase";
import { DeleteAssetUseCase } from "./core/usecase/delete_asset.usecase";
import { AssetMutationsUseCase } from "./core/usecase/asset_mutations.usecase";
import { ServiceContainer } from "$services/shared/base";
import { OutboxRepositoryImpl } from "$services/shared/infra/db/drizzle/outbox.repository";
import { OutboxRepository } from "$services/shared/kernel/outbox/outbox-repository.port";
import { UnitOfWork } from "$services/shared/kernel/uow.port";
import { AssetRepositoryImpl } from "./adapters/driven/drizzle/asset.repository";
import { UnitOfWorkImpl } from "./adapters/driven/drizzle/uow.repository";
import { AssetRepository } from "./core/ports/out/asset-repository.port";

export type { MutateAssetInput, MutateAssetResult };

/** Hasil TF dari `transferAsset`; sejajar `SwapBalanceResult` di domain transactions. */
export type AssetTransferResult = { from: Asset; to: Asset };

export class AssetService {
  static #instanceAssetService: AssetService;
  #createAsset: CreateAssetUseCase;
  #createDefaultAssetCash: CreateDefaultAssetCashUseCase;
  #listAssets: ListAssetsUseCase;
  #assetByName: AssetByNameUseCase;
  #assetById: AssetByIdUseCase;
  #updateAsset: UpdateAssetUseCase;
  #mutateAsset: MutateAssetUseCase;
  #deleteAsset: DeleteAssetUseCase;
  #assetMutations: AssetMutationsUseCase;

  @logMethod(logger)
  static init(
    createAsset: CreateAssetUseCase,
    createDefaultAssetCash: CreateDefaultAssetCashUseCase,
    listAssets: ListAssetsUseCase,
    assetByName: AssetByNameUseCase,
    assetById: AssetByIdUseCase,
    updateAsset: UpdateAssetUseCase,
    applyMutation: ApplyAssetMutationUseCase,
    mutateAsset: MutateAssetUseCase,
    deleteAsset: DeleteAssetUseCase,
    assetMutations: AssetMutationsUseCase,
  ): AssetService {
    AssetService.#instanceAssetService = new AssetService(
      createAsset,
      createDefaultAssetCash,
      listAssets,
      assetByName,
      assetById,
      updateAsset,
      applyMutation,
      mutateAsset,
      deleteAsset,
      assetMutations,
    );
    return AssetService.#instanceAssetService;
  }

  @logMethod(logger)
  static getInstance(): AssetService {
    if (!AssetService.#instanceAssetService) {
      throw new Error("AssetService not initialized");
    }
    return AssetService.#instanceAssetService;
  }

  private constructor(
    createAsset: CreateAssetUseCase,
    createDefaultAssetCash: CreateDefaultAssetCashUseCase,
    listAssets: ListAssetsUseCase,
    assetByName: AssetByNameUseCase,
    assetById: AssetByIdUseCase,
    updateAsset: UpdateAssetUseCase,
    applyMutation: ApplyAssetMutationUseCase,
    mutateAsset: MutateAssetUseCase,
    deleteAsset: DeleteAssetUseCase,
    assetMutations: AssetMutationsUseCase,
  ) {
    this.#createAsset = createAsset;
    this.#createDefaultAssetCash = createDefaultAssetCash;
    this.#listAssets = listAssets;
    this.#assetByName = assetByName;
    this.#assetById = assetById;
    this.#updateAsset = updateAsset;
    this.#mutateAsset = mutateAsset;
    this.#deleteAsset = deleteAsset;
    this.#assetMutations = assetMutations;
  }

  @logMethod(logger)
  async createAsset(input: AssetInput): Promise<Asset> {
    return this.#createAsset.execute(input);
  }

  @logMethod(logger)
  async createDefaultAssetCash(userId: ID): Promise<Asset> {
    return this.#createDefaultAssetCash.execute(userId);
  }

  @logMethod(logger)
  async assets(userId: ID): Promise<Asset[]> {
    return this.#listAssets.execute(userId);
  }

  @logMethod(logger)
  async assetByName(name: string, userId: ID): Promise<Asset> {
    return this.#assetByName.execute({ name, userId });
  }

  @logMethod(logger)
  async assetById(userId: ID, assetId: ID): Promise<Asset | null> {
    return this.#assetById.execute({ userId, assetId });
  }

  @logMethod(logger)
  async updateAsset(
    userId: ID,
    assetId: ID,
    input: Partial<AssetInput> & { balance?: Money },
  ): Promise<Asset> {
    return this.#updateAsset.execute({ userId, assetId, data: input });
  }

  /**
   * Mutasi asset terpadu (CR/DB/TF/EB/ADM). Satu pintu untuk credit, debit,
   * transfer antar-asset, transaksi e-wallet/banking, dan biaya admin.
   */
  @logMethod(logger)
  async mutateAsset(input: MutateAssetInput): Promise<MutateAssetResult> {
    return this.#mutateAsset.execute(input);
  }

  /**
   * Convenience TF (transfer) yang memenuhi kontrak `AssetSwapGateway`
   * di domain transactions.
   */
  @logMethod(logger)
  async transferAsset(
    userId: ID,
    fromAssetId: ID,
    toAssetId: ID,
    amount: Money,
  ): Promise<AssetTransferResult> {
    const result = await this.#mutateAsset.execute({
      userId,
      code: "TF",
      fromAssetId,
      toAssetId,
      amount,
    });
    if (result.code !== "TF") {
      throw new Error("transferAsset expected a TF result");
    }
    return { from: result.from, to: result.to };
  }

  @logMethod(logger)
  async deleteAsset(name: string, userId: ID): Promise<void> {
    return this.#deleteAsset.execute({ name, userId });
  }

  @logMethod(logger)
  async assetMutations(userId: ID, assetId: ID): Promise<AssetMutationData[]> {
    return this.#assetMutations.execute({ userId, assetId });
  }
}

export type AssetAdapters = {
  assetRepo: AssetRepository;
  uow: UnitOfWork;
  outboxRepo: OutboxRepository;
};

export function createAssetService({ assetRepo, uow, outboxRepo }: AssetAdapters): AssetService {
  const container = new ServiceContainer()
    .set(AssetRepository, assetRepo)
    .set(UnitOfWork, uow)
    .set(OutboxRepository, outboxRepo);

  const createAsset = new CreateAssetUseCase().setContext(container);
  const createDefaultAssetCash = new CreateDefaultAssetCashUseCase().setContext(container);
  const applyMutation = new ApplyAssetMutationUseCase().setContext(container);
  const listAssets = new ListAssetsUseCase().setContext(container);
  const assetByName = new AssetByNameUseCase().setContext(container);
  const assetById = new AssetByIdUseCase().setContext(container);
  const updateAsset = new UpdateAssetUseCase().setContext(container);
  const mutateAsset = new MutateAssetUseCase().setContext(container);
  const deleteAsset = new DeleteAssetUseCase().setContext(container);
  const assetMutations = new AssetMutationsUseCase().setContext(container);

  container.set(CreateAssetUseCase, createAsset);
  container.set(CreateDefaultAssetCashUseCase, createDefaultAssetCash);
  container.set(ApplyAssetMutationUseCase, applyMutation);
  container.set(MutateAssetUseCase, mutateAsset);

  return AssetService.init(
    createAsset,
    createDefaultAssetCash,
    listAssets,
    assetByName,
    assetById,
    updateAsset,
    applyMutation,
    mutateAsset,
    deleteAsset,
    assetMutations,
  );
}

logger.info("Initializing AssetService...");
export const assetService = createAssetService({
  assetRepo: new AssetRepositoryImpl(),
  uow: new UnitOfWorkImpl(),
  outboxRepo: new OutboxRepositoryImpl(),
});
logger.info("AssetService initialized");
