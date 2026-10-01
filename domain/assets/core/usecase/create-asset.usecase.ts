import { ServiceError, ConflictError } from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset, type AssetInput } from "../model/asset.model";
import { Balance } from "../value-objects/balance.vo";
import { isMybe } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class CreateAssetUseCase extends CoreUsecase<Asset, AssetInput> {
  @logMethod(logger)
  async execute(input: AssetInput): Promise<Asset> {
    const assetRepo = this.deps.get(AssetRepository);
    const existing = await assetRepo.findByName(input.name, input.userId);
    if (existing) {
      throw new ConflictError(`Asset with name ${input.name} already exists`);
    }

    let asset = Asset.new({
      name: input.name,
      balance: input.balance,
      type: input.type,
      userId: input.userId,
    }).requiredAll();

    const result = await assetRepo.save({
      name: asset.name,
      type: asset.type,
      balance: input.balance,
      userId: asset.userId,
    });

    if (isMybe(result)) {
      throw new ServiceError("invalid return data of asset is null");
    }

    return result!;
  }
}
