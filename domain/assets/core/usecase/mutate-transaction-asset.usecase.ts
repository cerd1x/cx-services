import { Asset } from "../../adapters/driven/drizzle/asset.entity";
import { Balance } from "../value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import { ApplyAssetMutationUseCase } from "./apply-asset-mutation.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type MutateTransactionAssetInput = {
  userId: ID;
  assetId: ID;
  amount: string;
  description?: string;
};

export class MutateTransactionAssetUseCase extends CoreUsecase<
  Asset,
  MutateTransactionAssetInput
> {
  @logMethod(logger)
  async execute(input: MutateTransactionAssetInput): Promise<Asset> {
    const { userId, assetId, amount, description } = input;
    return this.deps.get(ApplyAssetMutationUseCase).execute({
      userId,
      assetId,
      type: "transaction",
      amount: Balance.new(amount),
      description,
    });
  }
}