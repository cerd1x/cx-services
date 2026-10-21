import { Asset } from "../model/asset.model";
import { Money, iso } from "@lib/money";
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
      balance: Money.zero(iso.IDR),
    });
  }
}
