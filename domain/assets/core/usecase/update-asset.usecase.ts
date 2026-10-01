import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset, type AssetUpdate } from "../entity/asset.entity";
import type { Balance } from "../value-objects/balance.vo";
import type { AssetInput } from "../entity/asset.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateAssetInput = {
  userId: ID;
  assetId: ID;
  data: Partial<AssetInput> & { balance?: Balance };
};

export class UpdateAssetUseCase extends CoreUsecase<Asset, UpdateAssetInput> {
  @logMethod(logger)
  async execute(input: UpdateAssetInput): Promise<Asset> {
    const assetRepo = this.deps.get(AssetRepository);
    const data: AssetUpdate = {};
    if (input.data.name) data.name = input.data.name;
    if (input.data.type) data.type = input.data.type;
    if (input.data.balance) data.balance = input.data.balance;

    return assetRepo.update(input.userId, input.assetId.toNumb, data);
  }
}
