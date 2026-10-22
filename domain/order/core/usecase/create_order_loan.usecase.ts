import { OrderRepository } from "../ports/out/order-repository.port";
import { Order } from "../model/order.model";
import type { Order as OrderType } from "../model/order.model";
import { ID } from "$services/shared/kernel";
import { TransactionService } from "$services/domain/transactions";
import { AssetService } from "$services/domain/assets";
import type { PaymentMethodType } from "../../../transactions/core/model/transaction.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import {
  assertCurrencyCode,
  assertItemCount,
  assertMoney,
  assertOptionalPositiveInt,
  resolveMoney,
} from "./order_input.validator";
import { logger } from "../value-objects/logger";

export type CreateOrderLoanInput = {
  userId: number;
  price: number;
  currency: string;
  itemCount: number;
  paymentMethod?: string;
  customerId?: number;
  description?: string;
  payWithAssetId?: number;
  paymentStatus?: "paid" | "unpaid";
};

export class CreateOrderLoanUseCase extends CoreUsecase<OrderType, CreateOrderLoanInput> {
  @logMethod(logger)
  async execute(input: CreateOrderLoanInput): Promise<OrderType> {
    const orderRepo = this.deps.get(OrderRepository);
    const data = input;

    assertCurrencyCode(data.currency);
    assertItemCount(data.itemCount);
    assertMoney(data.price, "price");
    assertOptionalPositiveInt(data.customerId, "customerId");
    assertOptionalPositiveInt(data.payWithAssetId, "payWithAssetId");

    const totalAmount = data.price * data.itemCount;
    const amount = resolveMoney(totalAmount, data.currency);
    const capital = resolveMoney(totalAmount, data.currency);

    let savedTxId: ID | null = null;
    let assetMutated = false;

    try {
      const createdTx = await TransactionService.getInstance().createTransaction({
        userId: data.userId,
        type: "expense",
        amount,
        capital,
        createdAt: new Date(),
        description: data.description ?? `Loan: ${totalAmount} ${data.currency}`,
        category: "Loan",
        paymentMethod: data.paymentMethod
          ? { type: data.paymentMethod as PaymentMethodType }
          : { type: "cash" },
        customerId: data.customerId,
        status: "success",
        paymentStatus: data.paymentStatus,
        payWithAssetId: data.payWithAssetId,
      });
      savedTxId = createdTx.id ?? null;

      if (data.payWithAssetId) {
        await AssetService.getInstance().mutateSubtractAsset(
          ID.new(data.userId),
          ID.new(data.payWithAssetId),
          amount,
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
            amount,
          );
        } catch {
          /* ignore rollback error */
        }
      }

      throw error;
    }
  }
}
