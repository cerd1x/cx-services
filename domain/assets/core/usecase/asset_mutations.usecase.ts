import { AssetRepository } from "../ports/out/asset-repository.port";
import type { AssetMutationData } from "../model/asset-mutation.model";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type AssetMutationsInput = {
  userId: ID;
  assetId: ID;
};

export class AssetMutationsUseCase extends CoreUsecase<AssetMutationData[], AssetMutationsInput> {
  @logMethod(logger)
  async execute(input: AssetMutationsInput): Promise<AssetMutationData[]> {
    const assetRepo = this.deps.get(AssetRepository);
    return assetRepo.findMutationsByAssetId(input.assetId, input.userId);
  }
}
