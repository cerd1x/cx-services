import { Asset } from "../entity/asset.entity";
import { Balance } from "../value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import { CreateAssetUseCase } from "./create-asset.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class CreateDefaultAssetCashUseCase extends CoreUsecase<Asset, ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<Asset> {
    const createAsset = this.deps.get(CreateAssetUseCase);
    return createAsset.execute({
      userId,
      name: "MyCash",
      type: "cash",
      balance: Balance.zero("IDR"),
    });
  }
}
