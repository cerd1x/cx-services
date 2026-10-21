import { OrderRepository } from "../ports/out/order-repository.port";
import { Order } from "../model/order.model";
import type { Order as OrderType } from "../model/order.model";
import { ID } from "$services/shared/kernel";
import { ProductService } from "$services/domain/products";
import { TransactionService } from "$services/domain/transactions";
import { PaymentService } from "$services/domain/payment";
import { PaymentServiceCtx } from "./payment-service.ctx";
import { AssetService } from "$services/domain/assets";
import type { PaymentMethodType } from "../../../transactions/core/model/transaction.model";
import { CoreUsecase } from "$services/shared/base";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import {
  assertCurrencyCode,
  assertItemCount,
  assertMoney,
  assertOptionalPositiveInt,
  resolveMoney,
} from "./order-input.validator";

export type CreateOrderProductSaleInput = {
  userId: number;
  productId: ID;
  itemCount: number;
  price: number;
  currency: string;
  paymentMethod?: string;
  customerId?: number;
  description?: string;
  payToAssetId?: number;
  paymentStatus?: "paid" | "unpaid";
};

export class CreateOrderProductSaleUseCase extends CoreUsecase<
  OrderType,
  CreateOrderProductSaleInput
> {
  @logMethod(logger)
  async execute(input: CreateOrderProductSaleInput): Promise<OrderType> {
    const orderRepo = this.deps.get(OrderRepository);
    const data = input;

    assertCurrencyCode(data.currency);
    assertItemCount(data.itemCount);
    assertOptionalPositiveInt(data.customerId, "customerId");
    assertOptionalPositiveInt(data.payToAssetId, "payToAssetId");
    if (data.price !== undefined) assertMoney(data.price, "price");

    const product = await ProductService.getInstance().product(data.productId, data.userId);

    if (product.userId !== data.userId) {
      throw new Error("Product does not belong to this user");
    }

    if (product.trackStock && (product.stock ?? 0) < data.itemCount) {
      throw new Error(
        `Insufficient stock for product "${product.name}": available ${product.stock ?? 0}, requested ${data.itemCount}`,
      );
    }

    const appliedPrice = data.price ?? product.price;

    assertMoney(appliedPrice, "price");

    const saleAmount = appliedPrice * data.itemCount;
    const currency = data.currency.toUpperCase();
    const capitalAmount = (product.capital ?? 0) * data.itemCount;

    if (!Number.isFinite(capitalAmount) || capitalAmount < 0) {
      throw new ValidationError(
        `Invalid capital for product "${product.name}": ${product.capital}`,
      );
    }

    const capital = resolveMoney(capitalAmount, currency);
    const amount = resolveMoney(saleAmount, currency);
    const description = data.description ?? `Sale: ${product.name} x${data.itemCount}`;
    const paymentMethod = data.paymentMethod ?? "cash";

    let order = Order.new({
      userId: data.userId,
      price: appliedPrice,
      currency,
      itemCount: data.itemCount,
      description,
      paymentMethod,
      customerId: data.customerId,
      status: "pending",
    }).validateAll();

    order = await orderRepo.save(order);

    if (!order.id) {
      throw new Error("Failed to create order: no id returned");
    }

    let assetCredited = false;
    let stockDeducted = false;

    try {
      const paymentService = this.deps.get(PaymentServiceCtx) as unknown as PaymentService;
      const invoice = await paymentService.createInvoice({
        userId: data.userId,
        customerId: data.customerId,
        items: [
          {
            description: product.name,
            quantity: data.itemCount,
            unitPrice: appliedPrice,
          },
        ],
        currency,
        description,
      });

      const payment = await paymentService.processPayment({
        userId: data.userId,
        amount: saleAmount,
        currency,
        method: paymentMethod,
        assetId: data.payToAssetId,
        invoiceId: invoice.id,
        description,
      });

      if (payment.status !== "completed") {
        throw new Error(`Payment failed for order: ${payment.status}`);
      }

      await ProductService.getInstance().buy(
        data.productId,
        data.itemCount,
        data.userId,
        appliedPrice,
      );
      stockDeducted = true;

      if (data.payToAssetId) {
        await AssetService.getInstance().mutateAddAsset(
          ID.new(data.userId),
          ID.new(data.payToAssetId),
          amount,
        );
        assetCredited = true;
      }

      await TransactionService.getInstance().createTransaction({
        userId: data.userId,
        type: "income",
        amount,
        capital,
        createdAt: new Date(),
        description,
        category: "Product Sale",
        paymentMethod: { type: paymentMethod as PaymentMethodType },
        customerId: data.customerId,
        status: "success",
        paymentStatus: data.paymentStatus,
        payToAssetId: data.payToAssetId,
      });

      order.status = "success";
      order = await orderRepo.update(order, data.userId);

      return order;
    } catch (error) {
      if (assetCredited && data.payToAssetId) {
        try {
          await AssetService.getInstance().mutateSubtractAsset(
            ID.new(data.userId),
            ID.new(data.payToAssetId),
            amount,
          );
        } catch {
          /* ignore asset rollback error */
        }
      }

      if (stockDeducted) {
        try {
          await ProductService.getInstance().updateProduct(
            data.productId,
            {
              stock: (product.stock ?? 0) + data.itemCount,
            },
            data.userId,
          );
        } catch {
          /* ignore stock rollback error */
        }
      }

      try {
        order.status = "cancelled";
        await orderRepo.update(order, data.userId);
      } catch {
        /* ignore order rollback error */
      }

      throw error;
    }
  }
}
