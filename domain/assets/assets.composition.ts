import { Asset, type AssetInput } from "./adapters/driven/drizzle/asset.entity";
import { Balance } from "./core/value-objects/balance.vo";
import { type AssetMutationData } from "./adapters/driven/drizzle/asset-mutation.entity";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ID } from "$services/shared/kernel";
import { CreateAssetUseCase } from "./core/usecase/create-asset.usecase";
import { CreateDefaultAssetCashUseCase } from "./core/usecase/create-default-asset-cash.usecase";
import { ListAssetsUseCase } from "./core/usecase/list-assets.usecase";
import { AssetByNameUseCase } from "./core/usecase/asset-by-name.usecase";
import { AssetByIdUseCase } from "./core/usecase/asset-by-id.usecase";
import { UpdateAssetUseCase } from "./core/usecase/update-asset.usecase";
import { ApplyAssetMutationUseCase } from "./core/usecase/apply-asset-mutation.usecase";
import { MutateAddAssetUseCase } from "./core/usecase/mutate-add-asset.usecase";
import { MutateSubtractAssetUseCase } from "./core/usecase/mutate-subtract-asset.usecase";
import { MutateTransactionAssetUseCase } from "./core/usecase/mutate-transaction-asset.usecase";
import { MutateSwapAssetUseCase } from "./core/usecase/mutate-swap-asset.usecase";
import { DeleteAssetUseCase } from "./core/usecase/delete-asset.usecase";
import { AssetMutationsUseCase } from "./core/usecase/asset-mutations.usecase";
import { ServiceContainer } from "$services/shared/base";
import { OutboxRepositoryImpl } from "$services/shared/infra/db/drizzle/outbox.repository";
import { OutboxRepository } from "$services/shared/kernel/outbox/outbox-repository.port";
import { UnitOfWork } from "$services/shared/kernel/uow.port";
import { AssetRepositoryImpl } from "./adapters/driven/drizzle/asset.repository";
import { UnitOfWorkImpl } from "./adapters/driven/drizzle/uow.repository";
import { AssetRepository } from "./core/ports/out/asset-repository.port";

export class AssetService {
  static #instanceAssetService: AssetService;
  #createAsset: CreateAssetUseCase;
  #createDefaultAssetCash: CreateDefaultAssetCashUseCase;
  #listAssets: ListAssetsUseCase;
  #assetByName: AssetByNameUseCase;
  #assetById: AssetByIdUseCase;
  #updateAsset: UpdateAssetUseCase;
  #applyMutation: ApplyAssetMutationUseCase;
  #mutateAddAsset: MutateAddAssetUseCase;
  #mutateSubtractAsset: MutateSubtractAssetUseCase;
  #mutateTransactionAsset: MutateTransactionAssetUseCase;
  #mutateSwapAsset: MutateSwapAssetUseCase;
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
    mutateAddAsset: MutateAddAssetUseCase,
    mutateSubtractAsset: MutateSubtractAssetUseCase,
    mutateTransactionAsset: MutateTransactionAssetUseCase,
    mutateSwapAsset: MutateSwapAssetUseCase,
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
      mutateAddAsset,
      mutateSubtractAsset,
      mutateTransactionAsset,
      mutateSwapAsset,
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
    mutateAddAsset: MutateAddAssetUseCase,
    mutateSubtractAsset: MutateSubtractAssetUseCase,
    mutateTransactionAsset: MutateTransactionAssetUseCase,
    mutateSwapAsset: MutateSwapAssetUseCase,
    deleteAsset: DeleteAssetUseCase,
    assetMutations: AssetMutationsUseCase,
  ) {
    this.#createAsset = createAsset;
    this.#createDefaultAssetCash = createDefaultAssetCash;
    this.#listAssets = listAssets;
    this.#assetByName = assetByName;
    this.#assetById = assetById;
    this.#updateAsset = updateAsset;
    this.#applyMutation = applyMutation;
    this.#mutateAddAsset = mutateAddAsset;
    this.#mutateSubtractAsset = mutateSubtractAsset;
    this.#mutateTransactionAsset = mutateTransactionAsset;
    this.#mutateSwapAsset = mutateSwapAsset;
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
    input: Partial<AssetInput> & { balance?: Balance },
  ): Promise<Asset> {
    return this.#updateAsset.execute({ userId, assetId, data: input });
  }

  @logMethod(logger)
  async mutateAddAsset(userId: ID, assetId: ID, amount: string): Promise<Asset> {
    return this.#mutateAddAsset.execute({ userId, assetId, amount });
  }

  @logMethod(logger)
  async mutateSubtractAsset(userId: ID, assetId: ID, amount: string): Promise<Asset> {
    return this.#mutateSubtractAsset.execute({ userId, assetId, amount });
  }

  @logMethod(logger)
  async mutateTransactionAsset(
    userId: ID,
    assetId: ID,
    amount: string,
    description?: string,
  ): Promise<Asset> {
    return this.#mutateTransactionAsset.execute({
      userId,
      assetId,
      amount,
      description,
    });
  }

  @logMethod(logger)
  async mutateSwapAsset(
    userId: ID,
    fromAssetId: ID,
    toAssetId: ID,
    amount: string,
  ): Promise<{ from: Asset; to: Asset }> {
    return this.#mutateSwapAsset.execute({
      userId,
      fromAssetId,
      toAssetId,
      amount,
    });
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
  const mutateAddAsset = new MutateAddAssetUseCase().setContext(container);
  const mutateSubtractAsset = new MutateSubtractAssetUseCase().setContext(container);
  const mutateTransactionAsset = new MutateTransactionAssetUseCase().setContext(container);
  const mutateSwapAsset = new MutateSwapAssetUseCase().setContext(container);
  const deleteAsset = new DeleteAssetUseCase().setContext(container);
  const assetMutations = new AssetMutationsUseCase().setContext(container);

  container.set(CreateAssetUseCase, createAsset);
  container.set(CreateDefaultAssetCashUseCase, createDefaultAssetCash);
  container.set(ApplyAssetMutationUseCase, applyMutation);

  return AssetService.init(
    createAsset,
    createDefaultAssetCash,
    listAssets,
    assetByName,
    assetById,
    updateAsset,
    applyMutation,
    mutateAddAsset,
    mutateSubtractAsset,
    mutateTransactionAsset,
    mutateSwapAsset,
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
