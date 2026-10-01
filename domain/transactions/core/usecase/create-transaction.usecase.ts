import { TransactionRepository } from "../ports/out/transaction-repository.port";
import { Transaction } from "../model/transaction.model";
import type { Transaction as TransactionType } from "../model/transaction.model";
import type { PaymentMethod } from "../model/transaction.model";
import { Balance } from "../../../assets/core/value-objects/balance.vo";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type TransactionInput = {
  type: "income" | "expense" | "transfer" | "outcome";
  amount: Balance;
  capital: Balance;
  createdAt?: Date;
  description?: string;
  category?: string;
  paymentMethod?: PaymentMethod;
  customerId?: number;
  status?: "pending" | "success" | "failed";
  userId?: number;
  payWithAssetId?: number;
  payToAssetId?: number;
};

export class CreateTransactionUseCase extends CoreUsecase<TransactionType, TransactionInput> {
  @logMethod(logger)
  async execute(input: TransactionInput): Promise<TransactionType> {
    const txRepo = this.deps.get(TransactionRepository);
    let tx = Transaction.new(input).validateAll();

    tx = await txRepo.save(tx);

    if (!tx.id) {
      throw new Error("Failed to create transaction: no id returned");
    }

    return tx;
  }
}
