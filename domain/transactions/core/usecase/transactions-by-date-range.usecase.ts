import { TransactionRepository } from "../ports/out/transaction-repository.port";
import type { Transaction as TransactionType } from "../../adapters/driven/drizzle/transaction.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type TransactionsByDateRangeInput = {
  start: Date;
  end: Date;
  userId: ID;
};

export class TransactionsByDateRangeUseCase extends CoreUsecase<
  TransactionType[],
  TransactionsByDateRangeInput
> {
  @logMethod(logger)
  async execute(
    input: TransactionsByDateRangeInput,
  ): Promise<TransactionType[]> {
    const txRepo = this.deps.get(TransactionRepository);
    return txRepo.findByDateRange(input.start, input.end, input.userId);
  }
}
