import { AssetRepository } from "../ports/out/asset-repository.port";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeleteAssetInput = {
  name: string;
  userId: ID;
};

export class DeleteAssetUseCase extends CoreUsecase<void, DeleteAssetInput> {
  @logMethod(logger)
  async execute(input: DeleteAssetInput): Promise<void> {
    const assetRepo = this.deps.get(AssetRepository);
    await assetRepo.delete(input.name, input.userId);
  }
}