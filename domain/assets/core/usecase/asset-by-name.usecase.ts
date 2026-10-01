import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../../adapters/driven/drizzle/asset.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class AssetByNameUseCase extends CoreUsecase<Asset, { name: string; userId: ID }> {
  @logMethod(logger)
  async execute(input: { name: string; userId: ID }): Promise<Asset> {
    const assetRepo = this.deps.get(AssetRepository);
    const data = await assetRepo.findByName(input.name, input.userId);
    if (!data) {
      throw new NotFoundError(`Asset ${input.name}`);
    }
    return data;
  }
}