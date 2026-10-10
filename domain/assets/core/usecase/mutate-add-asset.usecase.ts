import { Asset } from "../model/asset.model";
import { Balance } from "../value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import { TransactionService } from "$services/domain/transactions";
import { ApplyAssetMutationUseCase } from "./apply-asset-mutation.usecase";
import { CoreUsecase } from "$services/shared/base";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type MutateAddAssetInput = {
  userId: ID;
  assetId: ID;
  amount: string;
};

export class MutateAddAssetUseCase extends CoreUsecase<Asset, MutateAddAssetInput> {
  @logMethod(logger)
  async execute(input: MutateAddAssetInput): Promise<Asset> {
    const { userId, assetId, amount } = input;

    let balanceAmount: Balance;
    try {
      balanceAmount = Balance.new(amount);
    } catch (error) {
      throw new ValidationError(`Invalid amount: ${amount}`, { cause: error });
    }

    if (balanceAmount.value <= 0) {
      throw new ValidationError("amount must be positive");
    }

    const result = await this.deps
      .get(ApplyAssetMutationUseCase)
      .execute({ userId, assetId, type: "add", amount: balanceAmount });
    if (!result) return result;

    const capital = Balance.new(result.balance);
    capital.subtract(balanceAmount);

    if (capital.value < 0) {
      throw new ValidationError("Computed capital must be non-negative");
    }

    await TransactionService.getInstance().createTransaction({
      userId: userId.toNumb,
      payToAssetId: assetId.toNumb,
      amount: balanceAmount,
      capital,
      type: "income",
      category: "Add Balance",
      description: `Add(+) To👉️ ( ${result.name} )`,
      status: "success",
    });

    return result;
  }
}
