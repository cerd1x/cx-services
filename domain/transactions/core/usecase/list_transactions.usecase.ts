import { TransactionRepository } from "../ports/out/transaction-repository.port";
import type { Transaction as TransactionType } from "../model/transaction.model";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListTransactionsUseCase extends CoreUsecase<TransactionType[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<TransactionType[]> {
    const txRepo = this.deps.get(TransactionRepository);
    return txRepo.findAll(userId);
  }
}
