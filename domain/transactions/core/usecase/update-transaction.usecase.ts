import { TransactionRepository } from "../ports/out/transaction-repository.port";
import type {
  Transaction as TransactionType,
  TransactionUpdateData,
} from "../../adapters/driven/drizzle/transaction.entity";
import { ID } from "$services/shared/kernel";
import { TransactionByIdUseCase } from "./transaction-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateTransactionInput = {
  id: ID;
  data: TransactionUpdateData;
  userId: ID;
};

export class UpdateTransactionUseCase extends CoreUsecase<
  TransactionType,
  UpdateTransactionInput
> {
  @logMethod(logger)
  async execute(input: UpdateTransactionInput): Promise<TransactionType> {
    const txRepo = this.deps.get(TransactionRepository);
    const { id, data, userId } = input;
    const existing = await this.deps
      .get(TransactionByIdUseCase)
      .execute({ id, userId });

    if (data.type !== undefined) existing.type = data.type;

    if (data.category !== undefined) existing.category = data.category;
    if (data.paymentMethod !== undefined)
      existing.paymentMethod = {
        ...existing.paymentMethod,
        ...data.paymentMethod,
      };
    if (data.description !== undefined) existing.description = data.description;
    if (data.status !== undefined) existing.status = data.status;
    if (data.customerId !== undefined) existing.customerId = data.customerId;

    existing.validateAll();
    return txRepo.update(existing, userId);
  }
}
