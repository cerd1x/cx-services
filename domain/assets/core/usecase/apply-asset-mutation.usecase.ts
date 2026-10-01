import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../entity/asset.entity";
import { Balance } from "../value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import { UnitOfWork } from "$services/shared/kernel/uow.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ApplyAssetMutationInput = {
  userId: ID;
  assetId: ID;
  type: "add" | "subtract" | "transaction" | "swap";
  amount: Balance;
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
      throw new NotFoundError(`Asset ${assetId.toHash}`);
    }

    const current = Balance.new(asset.balance);

    if (type === "add") {
      current.add(amount);
    } else {
      current.subtract(amount);
    }

    await uowMutateAsset.run(async (tx) => {
      await assetRepo.createAssetMutation(
        assetId,
        {
          userId,
          assetId: assetId.toNumb,
          type,
          amount: amount.value,
          currency: amount.code,
          balanceBefore: asset.balance,
          balanceAfter: `${current.code} ${current.value}`,
          description,
        },
        tx,
      );

      await assetRepo.update(userId, assetId.toNumb, { balance: current }, tx);
    });

    return Asset.new({
      id: assetId.toNumb,
      userId: asset.userId,
      name: asset.name,
      type: asset.type,
      balance: current,
    });
  }
}
