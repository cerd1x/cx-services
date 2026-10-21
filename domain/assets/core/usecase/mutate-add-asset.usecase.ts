import { Asset } from "../model/asset.model";
import type { Money } from "@lib/money";
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
  amount: Money;
};

export class MutateAddAssetUseCase extends CoreUsecase<Asset, MutateAddAssetInput> {
  @logMethod(logger)
  async execute(input: MutateAddAssetInput): Promise<Asset> {
    const { userId, assetId, amount } = input;

    if (amount.toNumber() <= 0) {
      throw new ValidationError("amount must be positive");
    }

    const result = await this.deps
      .get(ApplyAssetMutationUseCase)
      .execute({ userId, assetId, type: "add", amount });
    if (!result) return result;

    const capital = result.balance.subtract(amount);

    if (capital.toNumber() < 0) {
      throw new ValidationError("Computed capital must be non-negative");
    }

    await TransactionService.getInstance().createTransaction({
      userId: userId.toNumb,
      payToAssetId: assetId.toNumb,
      amount,
      capital,
      type: "income",
      category: "Add Balance",
      description: `Add(+) To👉️ ( ${result.name} )`,
      status: "success",
    });

    return result;
  }
}
