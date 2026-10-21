import { TransactionRepository } from "../ports/out/transaction-repository.port";
import { Transaction } from "../model/transaction.model";
import type { Transaction as TransactionType } from "../model/transaction.model";
import type { PaymentMethod } from "../model/transaction.model";
import type { Money } from "@lib/money";
import { CoreUsecase } from "$services/shared/base";
import { ServiceError, ValidationError } from "$services/shared/kernel/errors/service-error";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type TransactionInput = {
  type: "income" | "expense" | "transfer" | "outcome";
  amount: Money;
  capital: Money;
  createdAt?: Date;
  description?: string;
  category?: string;
  paymentMethod?: PaymentMethod;
  customerId?: number;
  status?: "pending" | "success" | "failed";
  paymentStatus?: "paid" | "unpaid";
  userId?: number;
  payWithAssetId?: number;
  payToAssetId?: number;
};

export class CreateTransactionUseCase extends CoreUsecase<TransactionType, TransactionInput> {
  @logMethod(logger)
  async execute(input: TransactionInput): Promise<TransactionType> {
    const txRepo = this.deps.get(TransactionRepository);

    if (
      input.customerId !== undefined &&
      (!Number.isInteger(input.customerId) || input.customerId <= 0)
    ) {
      throw new ValidationError("customerId must be a positive integer");
    }

    const amount = input.amount.toNumber();
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError("amount must be a positive, finite balance");
    }

    const capital = input.capital.toNumber();
    if (!Number.isFinite(capital) || capital < 0) {
      throw new ValidationError("capital must be a finite, non-negative balance");
    }

    let tx = Transaction.new(input).validateAll();

    try {
      tx = await txRepo.save(tx);
    } catch (error) {
      throw new ServiceError("Failed to save transaction", 500, { cause: error });
    }

    if (!tx.id) {
      throw new ServiceError("Failed to create transaction: no id returned", 500);
    }

    return tx;
  }
}
