import {
  Payment,
  type PaymentData,
} from "../../adapters/driven/drizzle/payment.entity";
import { PaymentRepository } from "../ports/out/payment-repository.port";
import { PaymentGateway } from "../ports/out/payment-gateway.port";
import { RetryPolicy, RetryPolicyToken } from "../value-objects/retry-policy.vo";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export type ProcessPaymentInput = {
  userId: number;
  amount: number;
  currency: string;
  method: string;
  assetId?: number;
  invoiceId?: number;
  description?: string;
  metadata?: Record<string, unknown>;
};

export class ProcessPaymentUseCase extends CoreUsecase<
  PaymentData,
  ProcessPaymentInput
> {
  @logMethod(logger)
  async execute(input: ProcessPaymentInput): Promise<PaymentData> {
    const paymentRepo = this.deps.get(PaymentRepository);
    const gateway = this.deps.get(PaymentGateway);
    const retryPolicy = this.deps.get(RetryPolicyToken);

    const payment = Payment.new({
      userId: input.userId,
      amount: input.amount,
      currency: input.currency,
      method: input.method as Payment["method"],
      invoiceId: input.invoiceId,
      description: input.description,
      maxRetries: retryPolicy.maxRetries,
      metadata: input.metadata,
    }).validateAll();

    payment.transitionTo("processing");

    const saved = await paymentRepo.save({
      userId: payment.userId,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      gatewayRef: payment.gatewayRef,
      description: payment.description,
      retryCount: payment.retryCount,
      maxRetries: payment.maxRetries,
      metadata: payment.metadata,
      createdAt: new Date(),
    });

    const entity = new Payment({
      id: saved.id,
      userId: saved.userId,
      invoiceId: saved.invoiceId,
      amount: saved.amount,
      currency: saved.currency,
      method: saved.method as Payment["method"],
      status: saved.status as Payment["status"],
      gatewayRef: saved.gatewayRef,
      description: saved.description,
      retryCount: saved.retryCount,
      maxRetries: saved.maxRetries,
      metadata: saved.metadata,
      createdAt: saved.createdAt,
    });

    try {
      const gatewayResponse = await gateway.charge({
        userId: entity.userId,
        assetId: input.assetId,
        amount: entity.amount,
        currency: entity.currency,
        method: entity.method,
        description: entity.description,
        metadata: entity.metadata,
      });

      if (gatewayResponse.success) {
        entity.gatewayRef = gatewayResponse.gatewayRef;
        entity.transitionTo("completed");
      } else {
        entity.transitionTo("failed");
        entity.metadata = {
          ...entity.metadata,
          lastError: gatewayResponse.error,
        };
      }
    } catch (error) {
      entity.transitionTo("failed");
      entity.metadata = {
        ...entity.metadata,
        lastError:
          error instanceof Error ? error.message : "Unknown gateway error",
      };
    }

    return paymentRepo.update(
      saved.id!,
      {
        status: entity.status,
        gatewayRef: entity.gatewayRef,
        metadata: entity.metadata,
        retryCount: entity.retryCount,
      },
      ID.new(entity.userId),
    );
  }
}
