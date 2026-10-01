import { TransactionRepository } from "../ports/out/transaction-repository.port";
import { ID } from "$services/shared/kernel";
import { TransactionByIdUseCase } from "./transaction-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeleteTransactionInput = {
  id: ID;
  userId: ID;
};

export class DeleteTransactionUseCase extends CoreUsecase<
  void,
  DeleteTransactionInput
> {
  @logMethod(logger)
  async execute(input: DeleteTransactionInput): Promise<void> {
    const txRepo = this.deps.get(TransactionRepository);
    const { id, userId } = input;
    const { id: idTx } = await this.deps
      .get(TransactionByIdUseCase)
      .execute({ id, userId });

    if (!idTx) throw Error("Not Found");

    await txRepo.delete(idTx.toNumb, userId);
  }
}
