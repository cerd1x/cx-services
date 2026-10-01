import { Payment } from "../model/payment.model";
import type { PaymentData } from "../model/payment.model";
import { PaymentRepository } from "../ports/out/payment-repository.port";
import { PaymentGateway } from "../ports/out/payment-gateway.port";
import { PaymentRetryExhaustedError } from "../errors/payment-error";
import { RetryPolicy, RetryPolicyToken } from "../value-objects/retry-policy.vo";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class RetryPaymentUseCase extends CoreUsecase<PaymentData, { paymentId: ID; userId: ID }> {
  @logMethod(logger)
  async execute(input: { paymentId: ID; userId: ID }): Promise<PaymentData> {
    const paymentRepo = this.deps.get(PaymentRepository);
    const gateway = this.deps.get(PaymentGateway);
    const retryPolicy = this.deps.get(RetryPolicyToken);

    const existing = await paymentRepo.findById(input.paymentId.toNumb, input.userId);
    if (!existing) {
      throw new PaymentRetryExhaustedError(input.paymentId.toNumb, 0);
    }
    if (!existing.id) {
      throw new PaymentRetryExhaustedError(input.paymentId.toNumb, existing.maxRetries);
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
      throw new PaymentRetryExhaustedError(input.paymentId.toNumb, retryPolicy.maxRetries);
    }

    payment.incrementRetry();
    payment.transitionTo("processing");

    await paymentRepo.update(
      input.paymentId.toNumb,
      { status: payment.status, retryCount: payment.retryCount },
      input.userId,
    );

    try {
      const gatewayResponse = await gateway.charge({
        userId: payment.userId,
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
        payment.transitionTo("completed");
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
      input.paymentId.toNumb,
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
