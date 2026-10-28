import { Payment, ProcessPaymentType } from "../model/payment.model";
import type { PaymentData } from "../model/payment.model";
import { PaymentRepository } from "../ports/out/payment-repository.port";
import { PaymentGateway } from "../ports/out/payment-gateway.port";
import { PaymentRetryExhaustedError } from "../errors/payment-error";
import { RetryPolicyToken } from "../value-objects/retry-policy.vo";
import { AssetChargeGatewayToken } from "../value-objects/asset-charge-gateway.vo";
import { refundCharge, settleOrderProductSale } from "./payment_settlement.helper";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class RetryPaymentUseCase extends CoreUsecase<PaymentData, { paymentId: ID; userId: ID }> {
  @logMethod(logger)
  async execute(input: { paymentId: ID; userId: ID }): Promise<PaymentData> {
    const paymentRepo = this.deps.get(PaymentRepository);
    const defaultGateway = this.deps.get(PaymentGateway);
    const retryPolicy = this.deps.get(RetryPolicyToken);

    const existing = await paymentRepo.findById(input.paymentId.decode, input.userId);
    if (!existing) {
      throw new PaymentRetryExhaustedError(input.paymentId.decode, 0);
    }
    if (!existing.id) {
      throw new PaymentRetryExhaustedError(input.paymentId.decode, existing.maxRetries);
    }

    const payment = new Payment({
      id: existing.id,
      userId: existing.userId,
      amount: existing.amount,
      currency: existing.currency,
      method: existing.method as Payment["method"],
      status: existing.status as Payment["status"],
      invoiceId: existing.invoiceId,
      gatewayRef: existing.gatewayRef,
      description: existing.description,
      retryCount: existing.retryCount,
      maxRetries: existing.maxRetries,
      metadata: existing.metadata,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });

    if (!payment.canRetry() || !retryPolicy.shouldRetry(payment.retryCount)) {
      throw new PaymentRetryExhaustedError(input.paymentId.decode, retryPolicy.maxRetries);
    }

    payment.incrementRetry();
    payment.transitionTo("processing");

    await paymentRepo.update(
      input.paymentId.decode,
      { status: payment.status, retryCount: payment.retryCount },
      input.userId,
    );

    const type =
      payment.metadata?.paymentType === ProcessPaymentType.orderProductSale
        ? ProcessPaymentType.orderProductSale
        : ProcessPaymentType.general;
    const assetId =
      typeof payment.metadata?.assetId === "number" ? payment.metadata.assetId : undefined;
    const gateway =
      assetId !== undefined && this.deps.has(AssetChargeGatewayToken)
        ? this.deps.get(AssetChargeGatewayToken)
        : defaultGateway;

    try {
      const gatewayResponse = await gateway.charge({
        userId: payment.userId,
        assetId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        description: payment.description,
        metadata: {
          ...payment.metadata,
          isRetry: true,
          retryAttempt: payment.retryCount,
        },
      });

      if (gatewayResponse.success) {
        payment.gatewayRef = gatewayResponse.gatewayRef;

        try {
          if (type === ProcessPaymentType.orderProductSale) {
            await settleOrderProductSale(this.deps, payment);
          }
          payment.transitionTo("completed");
        } catch (error) {
          await refundCharge(gateway, gatewayResponse.gatewayRef);
          throw error;
        }
      } else {
        payment.transitionTo("failed");
        payment.metadata = {
          ...payment.metadata,
          lastError: gatewayResponse.error,
          nextRetryDelayMs: retryPolicy.getNextRetryDelay(payment.retryCount),
        };
      }
    } catch (error) {
      payment.transitionTo("failed");
      payment.metadata = {
        ...payment.metadata,
        lastError: error instanceof Error ? error.message : "Unknown gateway error",
        nextRetryDelayMs: retryPolicy.getNextRetryDelay(payment.retryCount),
      };
    }

    return paymentRepo.update(
      input.paymentId.decode,
      {
        status: payment.status,
        gatewayRef: payment.gatewayRef,
        metadata: payment.metadata,
        retryCount: payment.retryCount,
      },
      input.userId,
    );
  }
}
