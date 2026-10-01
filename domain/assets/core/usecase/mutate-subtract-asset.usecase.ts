import { Asset } from "../entity/asset.entity";
import { Balance } from "../value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import { TransactionService } from "$services/domain/transactions";
import { ApplyAssetMutationUseCase } from "./apply-asset-mutation.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type MutateSubtractAssetInput = {
  userId: ID;
  assetId: ID;
  amount: string;
};

export class MutateSubtractAssetUseCase extends CoreUsecase<Asset, MutateSubtractAssetInput> {
  @logMethod(logger)
  async execute(input: MutateSubtractAssetInput): Promise<Asset> {
    const { userId, assetId, amount } = input;
    const balanceAmount = Balance.new(amount);
    const result = await this.deps
      .get(ApplyAssetMutationUseCase)
      .execute({ userId, assetId, type: "subtract", amount: balanceAmount });
    if (!result) return result;

    const capital = Balance.new(result.balance);
    capital.add(balanceAmount);

    await TransactionService.getInstance().createTransaction({
      userId: userId.toNumb,
      payToAssetId: assetId.toNumb,
      amount: balanceAmount,
      capital,
      type: "outcome",
      category: "Subtract Balance",
      description: `Subtract(-) From ( ${result.name} )`,
      status: "success",
    });

    return result;
  }
}
