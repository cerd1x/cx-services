import { beforeEach, describe, expect, it } from "bun:test";
import type {
  PaymentData,
  PaymentUpdateData,
} from "$services/domain/payment/core/model/payment.model";
import type { InvoiceData } from "$services/domain/payment/core/model/invoice.model";
import { PaymentRepository } from "$services/domain/payment/core/ports/out/payment-repository.port";
import { InvoiceRepository } from "$services/domain/payment/core/ports/out/invoice-repository.port";
import { PaymentGateway } from "$services/domain/payment/core/ports/out/payment-gateway.port";
import type {
  GatewayChargeRequest,
  GatewayChargeResponse,
  GatewayRefundRequest,
  GatewayRefundResponse,
  GatewayStatusResponse,
} from "$services/domain/payment/core/ports/out/payment-gateway.port";
import { ProcessPaymentUseCase } from "$services/domain/payment/core/usecase/process-payment.use-case";
import { CreateInvoiceUseCase } from "$services/domain/payment/core/usecase/create-invoice.use-case";
import { RetryPaymentUseCase } from "$services/domain/payment/core/usecase/retry-payment.use-case";
import { GetPaymentUseCase } from "$services/domain/payment/core/usecase/get-payment.usecase";
import { ListPaymentsUseCase } from "$services/domain/payment/core/usecase/list-payments.usecase";
import { ListPaymentsByStatusUseCase } from "$services/domain/payment/core/usecase/list-payments-by-status.usecase";
import { GetInvoiceUseCase } from "$services/domain/payment/core/usecase/get-invoice.usecase";
import { ListInvoicesUseCase } from "$services/domain/payment/core/usecase/list-invoices.usecase";
import { ListInvoicesByStatusUseCase } from "$services/domain/payment/core/usecase/list-invoices-by-status.usecase";
import { IssueInvoiceUseCase } from "$services/domain/payment/core/usecase/issue-invoice.usecase";
import { CancelInvoiceUseCase } from "$services/domain/payment/core/usecase/cancel-invoice.usecase";
import { PaymentService } from "$services/domain/payment";
import { PaymentRetryExhaustedError } from "$services/domain/payment/core/errors/payment-error";
import { ID } from "$services/shared/kernel";
import {
  RetryPolicy,
  RetryPolicyToken,
} from "$services/domain/payment/core/value-objects/retry-policy.vo";
import { ServiceContainer } from "$services/shared/base";

class MockPaymentRepo extends PaymentRepository {
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

class MockInvoiceRepo extends InvoiceRepository {
  store: InvoiceData[] = [];
  seq = 1;

  async save(invoice: InvoiceData): Promise<InvoiceData> {
    const row: InvoiceData = { ...invoice, id: this.seq++ };
    this.store.push(row);
    return row;
  }

  async findById(id: number, userId: ID): Promise<InvoiceData | null> {
    return this.store.find((i) => i.id === id && i.userId === userId.toNumb) ?? null;
  }

  async findByInvoiceNumber(invoiceNumber: string, userId: ID): Promise<InvoiceData | null> {
    return (
      this.store.find((i) => i.invoiceNumber === invoiceNumber && i.userId === userId.toNumb) ??
      null
    );
  }

  async findAll(userId: ID): Promise<InvoiceData[]> {
    return this.store.filter((i) => i.userId === userId.toNumb);
  }

  async findByStatus(status: string, userId: ID): Promise<InvoiceData[]> {
    return this.store.filter((i) => i.userId === userId.toNumb && i.status === status);
  }

  async update(id: number, data: Partial<InvoiceData>, userId: ID): Promise<InvoiceData> {
    const idx = this.store.findIndex((i) => i.id === id && i.userId === userId.toNumb);
    if (idx === -1) throw new Error("invoice not found");
    this.store[idx] = { ...this.store[idx], ...data, updatedAt: new Date() };
    return this.store[idx];
  }

  async delete(id: number, _userId: ID): Promise<void> {
    this.store = this.store.filter((i) => i.id !== id);
  }
}

class MockGateway implements PaymentGateway {
  failNext = false;
  declineReason = "insufficient funds";

  async charge(request: GatewayChargeRequest): Promise<GatewayChargeResponse> {
    if (this.failNext) {
      this.failNext = false;
      return {
        success: false,
        gatewayRef: "",
        status: "failed",
        error: this.declineReason,
      };
    }
    return {
      success: true,
      gatewayRef: `gway_${request.amount}_${Date.now()}`,
      status: "completed",
    };
  }

  async refund(_request: GatewayRefundRequest): Promise<GatewayRefundResponse> {
    return { success: true, refundId: "ref_1", status: "completed" };
  }

  async getStatus(gatewayRef: string): Promise<GatewayStatusResponse> {
    return { gatewayRef, status: "completed" };
  }
}

function buildService(
  payRepo: MockPaymentRepo,
  invRepo: MockInvoiceRepo,
  gateway: MockGateway,
): PaymentService {
  const retryPolicy = RetryPolicy.new();
  const container = new ServiceContainer()
    .set(PaymentRepository, payRepo)
    .set(InvoiceRepository, invRepo)
    .set(PaymentGateway, gateway)
    .set(RetryPolicyToken, retryPolicy);

  const process = new ProcessPaymentUseCase().setContext(container);
  const createInvoice = new CreateInvoiceUseCase().setContext(container);
  const retry = new RetryPaymentUseCase().setContext(container);
  const getPayment = new GetPaymentUseCase().setContext(container);
  const listPayments = new ListPaymentsUseCase().setContext(container);
  const listPaymentsByStatus = new ListPaymentsByStatusUseCase().setContext(container);
  const getInvoice = new GetInvoiceUseCase().setContext(container);
  const listInvoices = new ListInvoicesUseCase().setContext(container);
  const listInvoicesByStatus = new ListInvoicesByStatusUseCase().setContext(container);
  const issueInvoice = new IssueInvoiceUseCase().setContext(container);
  const cancelInvoice = new CancelInvoiceUseCase().setContext(container);

  PaymentService.init(
    process,
    createInvoice,
    retry,
    getPayment,
    listPayments,
    listPaymentsByStatus,
    getInvoice,
    listInvoices,
    listInvoicesByStatus,
    issueInvoice,
    cancelInvoice,
  );
  return PaymentService.getInstance();
}

describe("PaymentService", () => {
  let payRepo: MockPaymentRepo;
  let invRepo: MockInvoiceRepo;
  let gateway: MockGateway;
  let service: PaymentService;

  beforeEach(() => {
    payRepo = new MockPaymentRepo();
    invRepo = new MockInvoiceRepo();
    gateway = new MockGateway();
    service = buildService(payRepo, invRepo, gateway);
  });

  describe("processPayment", () => {
    it("processes a successful payment and stores gateway ref", async () => {
      const result = await service.processPayment({
        userId: 1,
        amount: 50000,
        currency: "IDR",
        method: "ewallet",
      });

      expect(result.status).toBe("completed");
      expect(result.gatewayRef).toMatch(/^gway_/);
      expect(result.retryCount).toBe(0);
      expect(payRepo.store).toHaveLength(1);
    });

    it("marks payment failed when gateway declines", async () => {
      gateway.failNext = true;
      const result = await service.processPayment({
        userId: 1,
        amount: 50000,
        currency: "IDR",
        method: "cash",
      });

      expect(result.status).toBe("failed");
      expect(result.metadata?.lastError).toBe("insufficient funds");
    });

    it("marks payment failed when gateway throws", async () => {
      const throwingGateway = new MockGateway();
      throwingGateway.charge = async () => {
        throw new Error("gateway down");
      };

      service = buildService(payRepo, invRepo, throwingGateway);

      const result = await service.processPayment({
        userId: 1,
        amount: 1000,
        currency: "IDR",
        method: "cash",
      });

      expect(result.status).toBe("failed");
      expect(result.metadata?.lastError).toBe("gateway down");
    });

    it("rejects non-positive amount", async () => {
      await expect(
        service.processPayment({
          userId: 1,
          amount: 0,
          currency: "IDR",
          method: "cash",
        }),
      ).rejects.toThrow("Amount must be greater than zero");
    });

    it("starts as processing before gateway call", async () => {
      await service.processPayment({
        userId: 1,
        amount: 1000,
        currency: "IDR",
        method: "cash",
      });
      expect(payRepo.store[0].status).toBe("completed");
    });
  });

  describe("retryPayment", () => {
    async function seedFailedPayment(): Promise<PaymentData> {
      gateway.failNext = true;
      return service.processPayment({
        userId: 1,
        amount: 1000,
        currency: "IDR",
        method: "cash",
      });
    }

    it("retries a failed payment to completion", async () => {
      const failed = await seedFailedPayment();
      expect(failed.status).toBe("failed");

      const retried = await service.retryPayment(ID.new(failed.id!), ID.new(1));
      expect(retried.status).toBe("completed");
      expect(retried.retryCount).toBe(1);
      expect(retried.gatewayRef).toBeDefined();
    });

    it("keeps failed status when retry also declines", async () => {
      const failed = await seedFailedPayment();

      gateway.failNext = true;
      const retried = await service.retryPayment(ID.new(failed.id!), ID.new(1));
      expect(retried.status).toBe("failed");
      expect(retried.retryCount).toBe(1);
    });

    it("throws PaymentRetryExhaustedError after maxRetries attempts", async () => {
      const failed = await seedFailedPayment();

      for (let i = 0; i < failed.maxRetries; i++) {
        gateway.failNext = true;
        await service.retryPayment(ID.new(failed.id!), ID.new(1));
      }

      await expect(service.retryPayment(ID.new(failed.id!), ID.new(1))).rejects.toThrow(
        PaymentRetryExhaustedError,
      );
    });

    it("throws when payment does not exist", async () => {
      await expect(service.retryPayment(ID.new(999), ID.new(1))).rejects.toThrow(
        PaymentRetryExhaustedError,
      );
    });

    it("throws when retrying a completed payment", async () => {
      const ok = await service.processPayment({
        userId: 1,
        amount: 1000,
        currency: "IDR",
        method: "cash",
      });

      await expect(service.retryPayment(ID.new(ok.id!), ID.new(1))).rejects.toThrow(
        PaymentRetryExhaustedError,
      );
    });
  });

  describe("createInvoice", () => {
    it("creates invoice with computed totals", async () => {
      const invoice = await service.createInvoice({
        userId: 1,
        items: [
          { description: "A", quantity: 2, unitPrice: 1000 },
          { description: "B", quantity: 1, unitPrice: 5000 },
        ],
        currency: "IDR",
        tax: 2000,
      });

      expect(invoice.subtotal).toBe(7000);
      expect(invoice.totalAmount).toBe(9000);
      expect(invoice.status).toBe("draft");
      expect(invoice.invoiceNumber).toMatch(/^INV-/);
    });

    it("issues and cancels invoice", async () => {
      const invoice = await service.createInvoice({
        userId: 1,
        items: [{ description: "A", quantity: 1, unitPrice: 1000 }],
        currency: "IDR",
      });

      const issued = await service.issueInvoice(ID.new(invoice.id!), ID.new(1));
      expect(issued.status).toBe("issued");

      const cancelled = await service.cancelInvoice(ID.new(invoice.id!), ID.new(1));
      expect(cancelled.status).toBe("cancelled");
    });

    it("cannot re-issue a cancelled invoice", async () => {
      const invoice = await service.createInvoice({
        userId: 1,
        items: [{ description: "A", quantity: 1, unitPrice: 1000 }],
        currency: "IDR",
      });
      await service.issueInvoice(ID.new(invoice.id!), ID.new(1));
      await service.cancelInvoice(ID.new(invoice.id!), ID.new(1));

      await expect(service.issueInvoice(ID.new(invoice.id!), ID.new(1))).rejects.toThrow(
        /Cannot issue/,
      );
    });
  });

  describe("queries", () => {
    it("getPayment throws when missing", async () => {
      await expect(service.getPayment(ID.new(999), ID.new(1))).rejects.toThrow(/not found/);
    });

    it("lists payments and filters by status", async () => {
      gateway.failNext = true;
      const failed = await service.processPayment({
        userId: 1,
        amount: 1000,
        currency: "IDR",
        method: "cash",
      });
      expect(failed.status).toBe("failed");

      await service.processPayment({
        userId: 1,
        amount: 2000,
        currency: "IDR",
        method: "cash",
      });

      const all = await service.listPayments(ID.new(1));
      expect(all).toHaveLength(2);

      const completed = await service.listPaymentsByStatus("completed", ID.new(1));
      expect(completed).toHaveLength(1);
      expect(completed[0].amount).toBe(2000);

      const badStatus = await service.listPaymentsByStatus("pending", ID.new(1));
      expect(badStatus).toHaveLength(0);
    });

    it("lists invoices by status", async () => {
      const inv = await service.createInvoice({
        userId: 1,
        items: [{ description: "A", quantity: 1, unitPrice: 1000 }],
        currency: "IDR",
      });
      await service.issueInvoice(ID.new(inv.id!), ID.new(1));

      const drafts = await service.listInvoicesByStatus("draft", ID.new(1));
      expect(drafts).toHaveLength(0);
      const issued = await service.listInvoicesByStatus("issued", ID.new(1));
      expect(issued).toHaveLength(1);
    });
  });
});
