import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { TransactionRepository } from "../ports/out/transaction-repository.port";
import type { Transaction as TransactionType } from "../../adapters/driven/drizzle/transaction.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type TransactionByIdInput = {
  id: ID;
  userId: ID;
};

export class TransactionByIdUseCase extends CoreUsecase<
  TransactionType,
  TransactionByIdInput
> {
  @logMethod(logger)
  async execute(input: TransactionByIdInput): Promise<TransactionType> {
    const txRepo = this.deps.get(TransactionRepository);
    const tx = await txRepo.findById(input.id.toNumb, input.userId);

    if (!tx) {
      throw new NotFoundError(`Transaction with id ${input.id.toNumb}`);
    }
    return tx;
  }
}
