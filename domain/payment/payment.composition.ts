import { ProcessPaymentUseCase } from "./core/usecase/process_payment.usecase";
import { CreateInvoiceUseCase } from "./core/usecase/create_invoice.usecase";
import { RetryPaymentUseCase } from "./core/usecase/retry_payment.usecase";
import { GetPaymentUseCase } from "./core/usecase/get_payment.usecase";
import { ListPaymentsUseCase } from "./core/usecase/list_payments.usecase";
import { ListPaymentsByStatusUseCase } from "./core/usecase/list_payments_by_status.usecase";
import { GetInvoiceUseCase } from "./core/usecase/get_invoice.usecase";
import { ListInvoicesUseCase } from "./core/usecase/list_invoices.usecase";
import { ListInvoicesByStatusUseCase } from "./core/usecase/list_invoices_by_status.usecase";
import { IssueInvoiceUseCase } from "./core/usecase/issue_invoice.usecase";
import { CancelInvoiceUseCase } from "./core/usecase/cancel_invoice.usecase";
import { type PaymentData, ProcessPaymentType } from "./core/model/payment.model";
import { type InvoiceData, type InvoiceItem } from "./core/model/invoice.model";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ID } from "$services/shared/kernel";
import { ServiceContainer } from "$services/shared/base";
import { PaymentRepositoryImpl } from "./adapters/driven/drizzle/payment.repository";
import { InvoiceRepositoryImpl } from "./adapters/driven/drizzle/invoice.repository";
import { MockPaymentGateway } from "./adapters/driven/payment-gateway/mock-gateway.adapter";
import { AssetPaymentGateway } from "./adapters/driven/payment-gateway/asset-gateway.adapter";
import { LazyAssetMutator } from "./adapters/driven/payment-gateway/lazy-asset-mutator";
import { AssetSettlementAdapter } from "./adapters/driven/settlement/asset-settlement.adapter";
import { RetryPolicy, RetryPolicyToken } from "./core/value-objects/retry-policy.vo";
import { AssetChargeGatewayToken } from "./core/value-objects/asset-charge-gateway.vo";
import { PaymentSettlementPort } from "./core/ports/out/payment-settlement.port";
import { PaymentRepository } from "./core/ports/out/payment-repository.port";
import { InvoiceRepository } from "./core/ports/out/invoice-repository.port";
import { PaymentGateway } from "./core/ports/out/payment-gateway.port";

export class PaymentService {
  static #instancePaymentService: PaymentService;
  #processPayment: ProcessPaymentUseCase;
  #createInvoice: CreateInvoiceUseCase;
  #retryPayment: RetryPaymentUseCase;
  #getPayment: GetPaymentUseCase;
  #listPayments: ListPaymentsUseCase;
  #listPaymentsByStatus: ListPaymentsByStatusUseCase;
  #getInvoice: GetInvoiceUseCase;
  #listInvoices: ListInvoicesUseCase;
  #listInvoicesByStatus: ListInvoicesByStatusUseCase;
  #issueInvoice: IssueInvoiceUseCase;
  #cancelInvoice: CancelInvoiceUseCase;

  @logMethod(logger)
  static init(
    processPayment: ProcessPaymentUseCase,
    createInvoice: CreateInvoiceUseCase,
    retryPayment: RetryPaymentUseCase,
    getPayment: GetPaymentUseCase,
    listPayments: ListPaymentsUseCase,
    listPaymentsByStatus: ListPaymentsByStatusUseCase,
    getInvoice: GetInvoiceUseCase,
    listInvoices: ListInvoicesUseCase,
    listInvoicesByStatus: ListInvoicesByStatusUseCase,
    issueInvoice: IssueInvoiceUseCase,
    cancelInvoice: CancelInvoiceUseCase,
  ): PaymentService {
    PaymentService.#instancePaymentService = new PaymentService(
      processPayment,
      createInvoice,
      retryPayment,
      getPayment,
      listPayments,
      listPaymentsByStatus,
      getInvoice,
      listInvoices,
      listInvoicesByStatus,
      issueInvoice,
      cancelInvoice,
    );
    return PaymentService.#instancePaymentService;
  }

  @logMethod(logger)
  static getInstance(): PaymentService {
    if (!PaymentService.#instancePaymentService) {
      throw new Error("PaymentService not initialized");
    }
    return PaymentService.#instancePaymentService;
  }

  private constructor(
    processPayment: ProcessPaymentUseCase,
    createInvoice: CreateInvoiceUseCase,
    retryPayment: RetryPaymentUseCase,
    getPayment: GetPaymentUseCase,
    listPayments: ListPaymentsUseCase,
    listPaymentsByStatus: ListPaymentsByStatusUseCase,
    getInvoice: GetInvoiceUseCase,
    listInvoices: ListInvoicesUseCase,
    listInvoicesByStatus: ListInvoicesByStatusUseCase,
    issueInvoice: IssueInvoiceUseCase,
    cancelInvoice: CancelInvoiceUseCase,
  ) {
    this.#processPayment = processPayment;
    this.#createInvoice = createInvoice;
    this.#retryPayment = retryPayment;
    this.#getPayment = getPayment;
    this.#listPayments = listPayments;
    this.#listPaymentsByStatus = listPaymentsByStatus;
    this.#getInvoice = getInvoice;
    this.#listInvoices = listInvoices;
    this.#listInvoicesByStatus = listInvoicesByStatus;
    this.#issueInvoice = issueInvoice;
    this.#cancelInvoice = cancelInvoice;
  }

  @logMethod(logger)
  async processPayment(input: {
    userId: number;
    amount: number;
    currency: string;
    method: string;
    assetId?: number;
    invoiceId?: number;
    description?: string;
    type?: ProcessPaymentType;
  }): Promise<PaymentData> {
    return this.#processPayment.execute(input);
  }

  @logMethod(logger)
  async getPayment(id: ID, userId: ID): Promise<PaymentData> {
    return this.#getPayment.execute({ id, userId });
  }

  @logMethod(logger)
  async listPayments(userId: ID): Promise<PaymentData[]> {
    return this.#listPayments.execute(userId);
  }

  @logMethod(logger)
  async listPaymentsByStatus(status: string, userId: ID): Promise<PaymentData[]> {
    return this.#listPaymentsByStatus.execute({ status, userId });
  }

  @logMethod(logger)
  async retryPayment(id: ID, userId: ID): Promise<PaymentData> {
    return this.#retryPayment.execute({ paymentId: id, userId });
  }

  @logMethod(logger)
  async createInvoice(input: {
    userId: number;
    customerId?: number;
    items: InvoiceItem[];
    currency: string;
    tax?: number;
    dueAt?: Date;
    description?: string;
  }): Promise<InvoiceData> {
    return this.#createInvoice.execute(input);
  }

  @logMethod(logger)
  async getInvoice(id: ID, userId: ID): Promise<InvoiceData> {
    return this.#getInvoice.execute({ id, userId });
  }

  @logMethod(logger)
  async listInvoices(userId: ID): Promise<InvoiceData[]> {
    return this.#listInvoices.execute(userId);
  }

  @logMethod(logger)
  async listInvoicesByStatus(status: string, userId: ID): Promise<InvoiceData[]> {
    return this.#listInvoicesByStatus.execute({ status, userId });
  }

  @logMethod(logger)
  async issueInvoice(id: ID, userId: ID): Promise<InvoiceData> {
    return this.#issueInvoice.execute({ id, userId });
  }

  @logMethod(logger)
  async cancelInvoice(id: ID, userId: ID): Promise<InvoiceData> {
    return this.#cancelInvoice.execute({ id, userId });
  }
}

export type PaymentAdapters = {
  paymentRepo: PaymentRepository;
  invoiceRepo: InvoiceRepository;
  gateway: PaymentGateway;
  /** Gateway yang mendebit asset; dipakai saat request menyertakan `assetId`. */
  assetGateway?: PaymentGateway;
  /** Settlement internal (mis. kredit ke `setting.defaultAssetCashId`). */
  settlement?: PaymentSettlementPort;
  retryPolicy?: RetryPolicy;
};

export function createPaymentService({
  paymentRepo,
  invoiceRepo,
  gateway,
  assetGateway,
  settlement,
  retryPolicy = RetryPolicy.new(),
}: PaymentAdapters): PaymentService {
  const container = new ServiceContainer()
    .set(PaymentRepository, paymentRepo)
    .set(InvoiceRepository, invoiceRepo)
    .set(PaymentGateway, gateway)
    .set(RetryPolicyToken, retryPolicy);

  if (assetGateway) container.set(AssetChargeGatewayToken, assetGateway);
  if (settlement) container.set(PaymentSettlementPort, settlement);

  const processPayment = new ProcessPaymentUseCase().setContext(container);
  const retryPayment = new RetryPaymentUseCase().setContext(container);
  const createInvoice = new CreateInvoiceUseCase().setContext(container);
  const getInvoice = new GetInvoiceUseCase().setContext(container);
  const listInvoices = new ListInvoicesUseCase().setContext(container);
  const listInvoicesByStatus = new ListInvoicesByStatusUseCase().setContext(container);
  const issueInvoice = new IssueInvoiceUseCase().setContext(container);
  const cancelInvoice = new CancelInvoiceUseCase().setContext(container);
  const getPayment = new GetPaymentUseCase().setContext(container);
  const listPayments = new ListPaymentsUseCase().setContext(container);
  const listPaymentsByStatus = new ListPaymentsByStatusUseCase().setContext(container);

  return PaymentService.init(
    processPayment,
    createInvoice,
    retryPayment,
    getPayment,
    listPayments,
    listPaymentsByStatus,
    getInvoice,
    listInvoices,
    listInvoicesByStatus,
    issueInvoice,
    cancelInvoice,
  );
}

logger.info("Initializing PaymentService...");
export const paymentService = createPaymentService({
  paymentRepo: new PaymentRepositoryImpl(),
  invoiceRepo: new InvoiceRepositoryImpl(),
  gateway: new MockPaymentGateway(),
  // Gateway aset dipakai hanya saat `assetId` dikirim (mis. OrderProductSale).
  assetGateway: new AssetPaymentGateway(new LazyAssetMutator()),
  settlement: new AssetSettlementAdapter(),
});
logger.info("PaymentService initialized");
