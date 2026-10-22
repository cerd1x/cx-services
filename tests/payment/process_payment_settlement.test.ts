import { beforeEach, describe, expect, it } from "bun:test";
import type {
  PaymentData,
  PaymentUpdateData,
} from "$services/domain/payment/core/model/payment.model";
import { PaymentRepository } from "$services/domain/payment/core/ports/out/payment-repository.port";
import { PaymentGateway } from "$services/domain/payment/core/ports/out/payment-gateway.port";
import type {
  GatewayChargeRequest,
  GatewayChargeResponse,
  GatewayRefundRequest,
  GatewayRefundResponse,
  GatewayStatusResponse,
} from "$services/domain/payment/core/ports/out/payment-gateway.port";
import {
  PaymentSettlementPort,
  type PaymentSettlementInput,
} from "$services/domain/payment/core/ports/out/payment-settlement.port";
import { AssetChargeGatewayToken } from "$services/domain/payment/core/value-objects/asset-charge-gateway.vo";
import {
  RetryPolicy,
  RetryPolicyToken,
} from "$services/domain/payment/core/value-objects/retry-policy.vo";
import { ProcessPaymentType } from "$services/domain/payment/core/model/payment.model";
import { ProcessPaymentUseCase } from "$services/domain/payment/core/usecase/process-payment.use-case";
import { RetryPaymentUseCase } from "$services/domain/payment/core/usecase/retry-payment.use-case";
import { ServiceContainer } from "$services/shared/base";
import { ID } from "$services/shared/kernel";

class PaymentRepo extends PaymentRepository {
  store: PaymentData[] = [];
  seq = 1;

  async save(payment: PaymentData): Promise<PaymentData> {
    const row: PaymentData = { ...payment, id: this.seq++ };
    this.store.push(row);
    return row;
  }

  async findById(id: number, userId: ID): Promise<PaymentData | null> {
    return this.store.find((p) => p.id === id && p.userId === userId.toNumb) ?? null;
  }

  async findAll(userId: ID): Promise<PaymentData[]> {
    return this.store.filter((p) => p.userId === userId.toNumb);
  }

  async findByStatus(status: string, userId: ID): Promise<PaymentData[]> {
    return this.store.filter((p) => p.userId === userId.toNumb && p.status === status);
  }

  async findByInvoiceId(invoiceId: number, userId: ID): Promise<PaymentData[]> {
    return this.store.filter((p) => p.userId === userId.toNumb && p.invoiceId === invoiceId);
  }

  async findByGatewayRef(gatewayRef: string, userId: ID): Promise<PaymentData | null> {
    return (
      this.store.find((p) => p.userId === userId.toNumb && p.gatewayRef === gatewayRef) ?? null
    );
  }

  async update(id: number, data: PaymentUpdateData, userId: ID): Promise<PaymentData> {
    const idx = this.store.findIndex((p) => p.id === id && p.userId === userId.toNumb);
    if (idx === -1) throw new Error("payment not found");
    this.store[idx] = { ...this.store[idx], ...data };
    return this.store[idx];
  }

  async delete(id: number, _userId: ID): Promise<void> {
    this.store = this.store.filter((p) => p.id !== id);
  }
}

class Gateway implements PaymentGateway {
  failNext = false;
  charges: GatewayChargeRequest[] = [];
  refunds: GatewayRefundRequest[] = [];

  async charge(request: GatewayChargeRequest): Promise<GatewayChargeResponse> {
    this.charges.push(request);
    if (this.failNext) {
      this.failNext = false;
      return { success: false, gatewayRef: "", status: "failed", error: "declined" };
    }
    return { success: true, gatewayRef: `gway_${request.amount}`, status: "completed" };
  }

  async refund(request: GatewayRefundRequest): Promise<GatewayRefundResponse> {
    this.refunds.push(request);
    return { success: true, refundId: "ref_1", status: "completed" };
  }

  async getStatus(gatewayRef: string): Promise<GatewayStatusResponse> {
    return { gatewayRef, status: "completed" };
  }
}

class Settlement extends PaymentSettlementPort {
  defaultCashAssetIdValue: number | null = 20;
  settlements: PaymentSettlementInput[] = [];

  async defaultCashAssetId(_userId: number): Promise<number | null> {
    return this.defaultCashAssetIdValue;
  }

  async settle(input: PaymentSettlementInput): Promise<void> {
    if (input.assetId === -1) throw new Error("settlement failed");
    this.settlements.push(input);
  }
}

describe("ProcessPaymentUseCase — OrderProductSale settlement", () => {
  let repo: PaymentRepo;
  let defaultGateway: Gateway;
  let assetGateway: Gateway;
  let settlement: Settlement;
  let processPayment: ProcessPaymentUseCase;
  let retryPayment: RetryPaymentUseCase;

  beforeEach(() => {
    repo = new PaymentRepo();
    defaultGateway = new Gateway();
    assetGateway = new Gateway();
    settlement = new Settlement();

    const container = new ServiceContainer()
      .set(PaymentRepository, repo)
      .set(PaymentGateway, defaultGateway)
      .set(AssetChargeGatewayToken, assetGateway)
      .set(PaymentSettlementPort, settlement)
      .set(RetryPolicyToken, RetryPolicy.new());

    processPayment = new ProcessPaymentUseCase().setContext(container);
    retryPayment = new RetryPaymentUseCase().setContext(container);
  });

  it("charges assetId and settles to default cash asset", async () => {
    const result = await processPayment.execute({
      userId: 1,
      amount: 25000,
      currency: "IDR",
      method: "cash",
      assetId: 10,
      type: ProcessPaymentType.orderProductSale,
    });

    expect(result.status).toBe("completed");
    expect(assetGateway.charges).toHaveLength(1);
    expect(assetGateway.charges[0].assetId).toBe(10);
    expect(defaultGateway.charges).toHaveLength(0);
    expect(settlement.settlements).toEqual([
      { userId: 1, assetId: 20, amount: 25000, currency: "IDR" },
    ]);
  });

  it("does not settle for general payments", async () => {
    const result = await processPayment.execute({
      userId: 1,
      amount: 25000,
      currency: "IDR",
      method: "cash",
      assetId: 10,
      type: ProcessPaymentType.general,
    });

    expect(result.status).toBe("completed");
    expect(assetGateway.charges).toHaveLength(1);
    expect(settlement.settlements).toHaveLength(0);
  });

  it("requires assetId for OrderProductSale", async () => {
    await expect(
      processPayment.execute({
        userId: 1,
        amount: 25000,
        currency: "IDR",
        method: "cash",
        type: ProcessPaymentType.orderProductSale,
      }),
    ).rejects.toThrow("assetId is required for OrderProductSale payment");
    expect(assetGateway.charges).toHaveLength(0);
    expect(repo.store).toHaveLength(0);
  });

  it("refunds the charge when default cash asset is not configured", async () => {
    settlement.defaultCashAssetIdValue = null;

    const result = await processPayment.execute({
      userId: 1,
      amount: 25000,
      currency: "IDR",
      method: "cash",
      assetId: 10,
      type: ProcessPaymentType.orderProductSale,
    });

    expect(result.status).toBe("failed");
    expect(result.metadata?.lastError).toContain("defaultAssetCashId");
    expect(assetGateway.refunds).toHaveLength(1);
    expect(settlement.settlements).toHaveLength(0);
  });

  it("retries charge + settlement for an OrderProductSale payment", async () => {
    assetGateway.failNext = true;
    const failed = await processPayment.execute({
      userId: 1,
      amount: 25000,
      currency: "IDR",
      method: "cash",
      assetId: 10,
      type: ProcessPaymentType.orderProductSale,
    });
    expect(failed.status).toBe("failed");

    const retried = await retryPayment.execute({
      paymentId: ID.new(failed.id!),
      userId: ID.new(1),
    });

    expect(retried.status).toBe("completed");
    expect(assetGateway.charges).toHaveLength(2);
    expect(assetGateway.charges[1].assetId).toBe(10);
    expect(settlement.settlements).toHaveLength(1);
  });
});
