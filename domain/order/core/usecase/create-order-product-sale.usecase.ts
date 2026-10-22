import { OrderRepository } from "../ports/out/order-repository.port";
import { Order } from "../model/order.model";
import type { Order as OrderType } from "../model/order.model";
import { ProductService } from "$services/domain/products";
import { TransactionService } from "$services/domain/transactions";
import { PaymentService, ProcessPaymentType } from "$services/domain/payment";
import type { ID } from "$services/shared/kernel";
import { Money } from "@lib/money";
import { PaymentServiceCtx } from "./payment-service.ctx";
import type { PaymentMethodType } from "../../../transactions/core/model/transaction.model";
import { CoreUsecase } from "$services/shared/base";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { assertItemCount, assertOptionalPositiveInt } from "./order-input.validator";

export type CreateOrderProductSaleInput = {
  userId: number;
  productId: ID;
  itemCount: number;
  price: Money;
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

    assertItemCount(data.itemCount);
    assertOptionalPositiveInt(data.customerId, "customerId");
    assertOptionalPositiveInt(data.payToAssetId, "payToAssetId");
    if (!data.price.isPositive()) {
      throw new ValidationError("price must be a positive finite number");
    }

    const product = await ProductService.getInstance().product(data.productId, data.userId);

    if (product.userId !== data.userId) {
      throw new Error("Product does not belong to this user");
    }

    if (product.trackStock && (product.stock ?? 0) < data.itemCount) {
      throw new Error(
        `Insufficient stock for product "${product.name}": available ${product.stock ?? 0}, requested ${data.itemCount}`,
      );
    }

    const appliedPrice = data.price;
    const saleAmount = appliedPrice.multiply(data.itemCount);
    const currency = appliedPrice.currency.code.toUpperCase();
    const capitalPerItem = product.capital ?? 0;

    if (!Number.isFinite(capitalPerItem) || capitalPerItem < 0) {
      throw new ValidationError(
        `Invalid capital for product "${product.name}": ${product.capital}`,
      );
    }

    const capital = Money.fromNumber(capitalPerItem, appliedPrice.currency).multiply(
      data.itemCount,
    );
    const description = data.description ?? `Sale: ${product.name} x${data.itemCount}`;
    const paymentMethod = data.paymentMethod ?? "cash";

    let order = Order.new({
      userId: data.userId,
      price: appliedPrice.toNumber(),
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
            unitPrice: appliedPrice.toNumber(),
          },
        ],
        currency,
        description,
      });

      const payment = await paymentService.processPayment({
        userId: data.userId,
        amount: saleAmount.toNumber(),
        currency,
        method: paymentMethod,
        assetId: data.payToAssetId,
        invoiceId: invoice.id,
        description,
        // Tanpa asset tujuan tidak ada dana yang bisa di-charge/settle.
        type: data.payToAssetId ? ProcessPaymentType.orderProductSale : ProcessPaymentType.general,
      });

      if (payment.status !== "completed") {
        throw new Error(`Payment failed for order: ${payment.status}`);
      }

      await ProductService.getInstance().buy(
        data.productId,
        data.itemCount,
        data.userId,
        appliedPrice.toNumber(),
      );
      stockDeducted = true;

      // Settlement ke asset default cash dilakukan oleh ProcessPaymentUseCase
      // (type: OrderProductSale), jadi tidak ada kredit manual di sini.

      await TransactionService.getInstance().createTransaction({
        userId: data.userId,
        type: "income",
        amount: saleAmount,
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
