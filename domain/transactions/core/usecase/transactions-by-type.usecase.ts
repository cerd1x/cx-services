import { TransactionRepository } from "../ports/out/transaction-repository.port";
import type { Transaction as TransactionType } from "../../adapters/driven/drizzle/transaction.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type TransactionsByTypeInput = {
  type: string;
  userId: ID;
};

export class TransactionsByTypeUseCase extends CoreUsecase<
  TransactionType[],
  TransactionsByTypeInput
> {
  @logMethod(logger)
  async execute(input: TransactionsByTypeInput): Promise<TransactionType[]> {
    const txRepo = this.deps.get(TransactionRepository);
    return txRepo.findByType(input.type, input.userId);
  }
}
