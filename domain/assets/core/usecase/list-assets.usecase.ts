import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../entity/asset.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListAssetsUseCase extends CoreUsecase<Asset[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<Asset[]> {
    const assetRepo = this.deps.get(AssetRepository);
    return assetRepo.findAll(userId);
  }
}
