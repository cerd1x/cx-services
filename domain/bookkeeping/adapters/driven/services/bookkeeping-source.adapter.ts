import { findCurrency, Money } from "@lib/money";
import type { ID } from "$services/shared/kernel";
import { OrderService } from "$services/domain/order";
import { PaymentService } from "$services/domain/payment";
import type {
  BookkeepingPaymentData,
  BookkeepingTransactionData,
} from "../../../core/model/bookkeeping.model";
import { BookkeepingSource } from "../../../core/ports/out/bookkeeping-source.port";
import { logger } from "../../../core/value-objects/logger";

/**
 * Adapter produksi port BookkeepingSource.
 *
 * Semua akses lintas modul lewat service (bukan repository/entity internal),
 * dan di-resolve saat method dipanggil supaya urutan inisialisasi root
 * container tidak menimbulkan circular import.
 */
export class BookkeepingSourceAdapter implements BookkeepingSource {
  async listOrders(
    userId: ID,
    start: Date,
    endExclusive: Date,
  ): Promise<BookkeepingTransactionData[]> {
    const orders = await OrderService.getInstance().ordersByDateRange(
      start,
      endExclusive,
      userId,
    );

    return orders.map((order) => {
      const productCapital = order.productCapital;
      const capital =
        productCapital !== undefined
          ? Money.fromNumber(
              productCapital,
              order.totalAmount.currency,
            ).multiply(order.itemCount)
          : Money.zero(order.totalAmount.currency);

      return {
        id: order.id!.decode,
        type: order.productId !== undefined ? "income" : "expense",
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: {
          type: order.paymentMethod,
          assetId: undefined,
        },
        customerId: order.customerId,
        amount: order.totalAmount,
        capital,
        description: order.description,
        category: "Order",
        createdAt: order.createdAt!,
        updatedAt: order.updatedAt,
      };
    });
  }

  async listFailedPayments(
    userId: ID,
    start: Date,
    endExclusive: Date,
  ): Promise<BookkeepingPaymentData[]> {
    const payments = await PaymentService.getInstance().listPaymentsByStatus(
      "failed",
      userId,
    );

    return payments.flatMap((payment) => {
      const id = payment.id?.decode;
      const currency = findCurrency(payment.currency);
      if (id === undefined || !currency) {
        logger.warn(
          `[Bookkeeping] payment ${payment.id?.str ?? "-"} dilewati: id/currency tidak valid`,
        );
        return [];
      }

      const createdAt = payment.createdAt;
      if (
        !createdAt ||
        createdAt.getTime() < start.getTime() ||
        createdAt.getTime() >= endExclusive.getTime()
      ) {
        return [];
      }

      return [
        {
          id,
          amount: Money.fromNumber(payment.amount, currency),
          method: payment.method,
          status: payment.status,
          gatewayRef: payment.gatewayRef,
          description: payment.description,
          retryCount: payment.retryCount,
          maxRetries: payment.maxRetries,
          lastError: payment.getMetadataWithKey<string>("lastError"),
          createdAt,
          updatedAt: payment.updatedAt,
        },
      ];
    });
  }
}
