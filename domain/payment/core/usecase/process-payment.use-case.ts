import { Payment, ProcessPaymentType, type PaymentData } from "../model/payment.model";
import { PaymentRepository } from "../ports/out/payment-repository.port";
import { PaymentGateway } from "../ports/out/payment-gateway.port";
import { AssetChargeGatewayToken } from "../value-objects/asset-charge-gateway.vo";
import { RetryPolicyToken } from "../value-objects/retry-policy.vo";
import { refundCharge, settleOrderProductSale } from "./payment-settlement.helper";
import { CoreUsecase } from "$services/shared/base";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export type ProcessPaymentInput = {
  userId: number;
  amount: number;
  currency: string;
  method: string;
  /** Asset yang di-charge. Wajib untuk `type: OrderProductSale`. */
  assetId?: number;
  invoiceId?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  /**
   * Jenis proses pembayaran. `OrderProductSale` men-charge `assetId` lalu
   * menyettlekan dana ke asset default cash (`setting.defaultAssetCashId`).
   */
  type?: ProcessPaymentType;
};

export class ProcessPaymentUseCase extends CoreUsecase<PaymentData, ProcessPaymentInput> {
  @logMethod(logger)
  async execute(input: ProcessPaymentInput): Promise<PaymentData> {
    const paymentRepo = this.deps.get(PaymentRepository);
    const defaultGateway = this.deps.get(PaymentGateway);
    const retryPolicy = this.deps.get(RetryPolicyToken);
    const type = input.type ?? ProcessPaymentType.general;

    if (type === ProcessPaymentType.orderProductSale && input.assetId === undefined) {
      throw new ValidationError("assetId is required for OrderProductSale payment");
    }

    // Charge aset hanya memakai gateway aset (jika terpasang). Tanpa `assetId`
    // pembayaran tetap memakai gateway default agar alur non-asset tidak berubah.
    const gateway =
      input.assetId !== undefined && this.deps.has(AssetChargeGatewayToken)
        ? this.deps.get(AssetChargeGatewayToken)
        : defaultGateway;

    const payment = Payment.new({
      userId: input.userId,
      amount: input.amount,
      currency: input.currency,
      method: input.method as Payment["method"],
      invoiceId: input.invoiceId,
      description: input.description,
      maxRetries: retryPolicy.maxRetries,
      metadata: { ...input.metadata, paymentType: type, assetId: input.assetId },
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
        entity.metadata = {
          ...entity.metadata,
          assetId: this.#resolvedAssetId(input.assetId, gatewayResponse.raw),
        };

        try {
          if (type === ProcessPaymentType.orderProductSale) {
            await settleOrderProductSale(this.deps, entity);
          }
          entity.transitionTo("completed");
        } catch (error) {
          // Charge sudah terjadi; kembalikan dana sebelum payment ditandai gagal.
          await refundCharge(gateway, gatewayResponse.gatewayRef);
          throw error;
        }
      } else {
        entity.transitionTo("failed");
        entity.metadata = {
          ...entity.metadata,
          lastError: gatewayResponse.error,
        };
      }
    } catch (error) {
      if (entity.status !== "failed") {
        entity.transitionTo("failed");
      }
      entity.metadata = {
        ...entity.metadata,
        lastError: error instanceof Error ? error.message : "Unknown gateway error",
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

  #resolvedAssetId(
    requested: number | undefined,
    raw: Record<string, unknown> | undefined,
  ): number | undefined {
    if (requested !== undefined) return requested;
    const fromGateway = raw?.assetId;
    return typeof fromGateway === "number" ? fromGateway : undefined;
  }
}
