import { NotFound } from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../model/asset.model";
import type { Money } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { UnitOfWork } from "$services/shared/kernel/uow.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ApplyAssetMutationInput = {
  userId: ID;
  assetId: ID;
  type: "add" | "subtract" | "transaction" | "swap";
  amount: Money;
  description?: string;
};

export class ApplyAssetMutationUseCase extends CoreUsecase<Asset, ApplyAssetMutationInput> {
  @logMethod(logger)
  async execute(input: ApplyAssetMutationInput): Promise<Asset> {
    const assetRepo = this.deps.get(AssetRepository);
    const uowMutateAsset = this.deps.get(UnitOfWork);
    const { userId, assetId, type, amount, description } = input;

    const asset = await assetRepo.findById(userId, assetId);
    if (!asset) {
      throw new NotFound(`Asset ${assetId.toHash}`);
    }

    const current = asset.balance;

    const next = type === "add" ? current.add(amount) : current.subtract(amount);

    await uowMutateAsset.run(async (tx) => {
      await assetRepo.createAssetMutation(
        assetId,
        {
          userId,
          assetId: assetId.toNumb,
          type,
          amount,
          balanceBefore: current,
          balanceAfter: next,
          description,
        },
        tx,
      );

      await assetRepo.update(userId, assetId.toNumb, { balance: next }, tx);
    });

    return Asset.new({
      id: assetId.toNumb,
      userId: asset.userId,
      name: asset.name,
      type: asset.type,
      balance: next,
    });
  }
}
