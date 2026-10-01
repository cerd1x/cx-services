import { TransactionRepository } from "../ports/out/transaction-repository.port";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import {
  resolvePageQuery,
  toTransactionPage,
  type PageRequest,
  type TransactionPage,
} from "../model/transaction-page.model";

export type ListTransactionsPageInput = PageRequest & { userId: ID };

export class ListTransactionsPageUseCase extends CoreUsecase<TransactionPage, ListTransactionsPageInput> {
  @logMethod(logger)
  async execute(input: ListTransactionsPageInput): Promise<TransactionPage> {
    const { userId, ...request } = input;
    const query = resolvePageQuery(request);
    const txRepo = this.deps.get(TransactionRepository);
    const window = await txRepo.findPage(userId, query);
    return toTransactionPage(window, query.direction);
  }
}
