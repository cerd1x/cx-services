import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../entity/asset.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class AssetByIdUseCase extends CoreUsecase<Asset | null, { userId: ID; assetId: ID }> {
  @logMethod(logger)
  async execute(input: { userId: ID; assetId: ID }): Promise<Asset | null> {
    const assetRepo = this.deps.get(AssetRepository);
    return assetRepo.findById(input.userId, input.assetId);
  }
}
