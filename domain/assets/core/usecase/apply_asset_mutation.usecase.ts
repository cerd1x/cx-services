import { NotFound, ValidationError } from "$services/shared/kernel/errors/service-error";
import { AssetRepository } from "../ports/out/asset-repository.port";
import { Asset } from "../model/asset.model";
import type { Money } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { UnitOfWork } from "$services/shared/kernel/uow.port";
import { MUTATION_DIRECTION, type SingleAssetMutationType } from "../model/asset-mutation.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ApplyAssetMutationInput = {
  userId: ID;
  assetId: ID;
  /** Hanya kode satu-asset (CR/DB/EB/ADM). TF ditangani `MutateAssetUseCase`. */
  type: SingleAssetMutationType;
  amount: Money;
  description?: string;
};

/**
 * Leg tunggal mutasi asset: catat `AssetMutation` + update saldo dalam satu UoW.
 * `CR` menambah saldo; `DB`/`EB`/`ADM` mengurangi saldo (cek saldo cukup).
 */
export class ApplyAssetMutationUseCase extends CoreUsecase<Asset, ApplyAssetMutationInput> {
  @logMethod(logger)
  async execute(input: ApplyAssetMutationInput): Promise<Asset> {
    const assetRepo = this.deps.get(AssetRepository);
    const uowMutateAsset = this.deps.get(UnitOfWork);
    const { userId, assetId, type, amount, description } = input;

    const asset = await assetRepo.findById(userId, assetId);
    if (!asset) {
      throw new NotFound(`Asset ${assetId.str}`);
    }

    const current = asset.balance;

    let next: Money;
    switch (MUTATION_DIRECTION[type]) {
      case "credit":
        next = current.add(amount);
        break;
      case "debit":
        if (current.lt(amount)) {
          throw new ValidationError(
            `Insufficient balance: have ${current.toString()}, need ${amount.toString()}`,
          );
        }
        next = current.subtract(amount);
        break;
      default:
        throw new ValidationError(`Unsupported single-asset mutation type: ${type}`);
    }

    await uowMutateAsset.run(async (tx) => {
      await assetRepo.createAssetMutation(
        assetId,
        {
          userId,
          assetId: assetId.decode,
          type,
          amount,
          balanceBefore: current,
          balanceAfter: next,
          description,
        },
        tx,
      );

      await assetRepo.update(userId, assetId.decode, { balance: next }, tx);
    });

    return Asset.new({
      id: assetId.decode,
      userId: asset.userId,
      name: asset.name,
      type: asset.type,
      balance: next,
    });
  }
}
