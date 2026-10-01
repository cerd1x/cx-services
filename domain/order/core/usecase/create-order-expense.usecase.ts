import { OrderRepository } from "../ports/out/order-repository.port";
import { Order } from "../entity/order.entity";
import type { Order as OrderType } from "../entity/order.entity";
import { ID } from "$services/shared/kernel";
import { Balance } from "../../../assets/core/value-objects/balance.vo";
import { TransactionService } from "$services/domain/transactions";
import { AssetService } from "$services/domain/assets";
import type { PaymentMethodType } from "../../../transactions/core/entity/transaction.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type CreateOrderExpenseInput = {
  userId: number;
  price: number;
  currency: string;
  itemCount: number;
  paymentMethod?: string;
  customerId?: number;
  description?: string;
  payWithAssetId?: number;
};

export class CreateOrderExpenseUseCase extends CoreUsecase<OrderType, CreateOrderExpenseInput> {
  @logMethod(logger)
  async execute(input: CreateOrderExpenseInput): Promise<OrderType> {
    const orderRepo = this.deps.get(OrderRepository);
    const data = input;

    const totalAmount = data.price * data.itemCount;
    const amount = Balance.new(`${data.currency} ${totalAmount}`);
    const capital = Balance.new(`${data.currency} ${totalAmount}`);

    let savedTxId: ID | null = null;
    let assetMutated = false;

    try {
      const createdTx = await TransactionService.getInstance().createTransaction({
        userId: data.userId,
        type: "expense",
        amount,
        capital,
        createdAt: new Date(),
        description: data.description ?? `Expense: ${totalAmount} ${data.currency}`,
        category: "Expense",
        paymentMethod: data.paymentMethod
          ? { type: data.paymentMethod as PaymentMethodType }
          : { type: "cash" },
        customerId: data.customerId,
        status: "success",
        payWithAssetId: data.payWithAssetId,
      });
      savedTxId = createdTx.id ?? null;

      if (data.payWithAssetId) {
        await AssetService.getInstance().mutateSubtractAsset(
          ID.new(data.userId),
          ID.new(data.payWithAssetId),
          `${data.currency} ${totalAmount}`,
        );
        assetMutated = true;
      }

      let order = Order.new({
        userId: data.userId,
        price: data.price,
        currency: data.currency,
        itemCount: data.itemCount,
        paymentMethod: data.paymentMethod,
        description: data.description,
        customerId: data.customerId,
        status: "success",
      }).validateAll();

      order = await orderRepo.save(order);

      if (!order.id) {
        throw new Error("Failed to create order: no id returned");
      }

      return order;
    } catch (error) {
      if (savedTxId) {
        try {
          await TransactionService.getInstance().deleteTransaction(savedTxId, ID.new(data.userId));
        } catch {
          /* ignore rollback error */
        }
      }

      if (assetMutated && data.payWithAssetId) {
        try {
          await AssetService.getInstance().mutateAddAsset(
            ID.new(data.userId),
            ID.new(data.payWithAssetId),
            `${data.currency} ${totalAmount}`,
          );
        } catch {
          /* ignore rollback error */
        }
      }

      throw error;
    }
  }
}
