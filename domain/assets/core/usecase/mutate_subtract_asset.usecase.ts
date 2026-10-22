import { Asset } from "../model/asset.model";
import type { Money } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { TransactionService } from "$services/domain/transactions";
import { ApplyAssetMutationUseCase } from "./apply_asset_mutation.usecase";
import { CoreUsecase } from "$services/shared/base";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type MutateSubtractAssetInput = {
  userId: ID;
  assetId: ID;
  amount: Money;
};

export class MutateSubtractAssetUseCase extends CoreUsecase<Asset, MutateSubtractAssetInput> {
  @logMethod(logger)
  async execute(input: MutateSubtractAssetInput): Promise<Asset> {
    const { userId, assetId, amount } = input;

    if (amount.toNumber() <= 0) {
      throw new ValidationError("amount must be positive");
    }
    const result = await this.deps
      .get(ApplyAssetMutationUseCase)
      .execute({ userId, assetId, type: "subtract", amount });
    if (!result) return result;

    const capital = result.balance.add(amount);

    await TransactionService.getInstance().createTransaction({
      userId: userId.toNumb,
      payToAssetId: assetId.toNumb,
      amount,
      capital,
      type: "outcome",
      category: "Subtract Balance",
      description: `Subtract(-) From ( ${result.name} )`,
      status: "success",
    });

    return result;
  }
}
