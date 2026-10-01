import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setDB, setD1 } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { paymentTable } from "$services/shared/infra/db/drizzle-schema/payment.schema";
import { invoiceTable } from "$services/shared/infra/db/drizzle-schema/invoice.schema";
import { eq } from "drizzle-orm";
import { PaymentRepositoryImpl } from "$services/domain/payment/adapters/driven/drizzle/payment.repository";
import { InvoiceRepositoryImpl } from "$services/domain/payment/adapters/driven/drizzle/invoice.repository";
import { MockPaymentGateway } from "$services/domain/payment/adapters/driven/payment-gateway/mock-gateway.adapter";
import { PaymentRepository } from "$services/domain/payment/core/ports/out/payment-repository.port";
import { InvoiceRepository } from "$services/domain/payment/core/ports/out/invoice-repository.port";
import { PaymentGateway } from "$services/domain/payment/core/ports/out/payment-gateway.port";
import { RetryPolicy, RetryPolicyToken } from "$services/domain/payment/core/value-objects/retry-policy.vo";
import { ServiceContainer } from "$services/shared/base";
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

describe("Payment integration", () => {
  let sqlite: any;
  let db: ReturnType<typeof drizzle>;
  let service: PaymentService;
  let gateway: MockPaymentGateway;

  beforeAll(() => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    db = drizzle(env.d1 as any);
    setDB(db as any);
    setD1(env.d1 as any);

    const payRepo = new PaymentRepositoryImpl();
    const invRepo = new InvoiceRepositoryImpl();
    gateway = new MockPaymentGateway();
    const retryPolicy = RetryPolicy.new();

    const container = new ServiceContainer()
      .set(PaymentRepository, payRepo)
      .set(InvoiceRepository, invRepo)
      .set(PaymentGateway, gateway)
      .set(RetryPolicyToken, retryPolicy);

    const process = new ProcessPaymentUseCase().setContext(container);
    const createInvoice = new CreateInvoiceUseCase().setContext(container);
    const retry = new RetryPaymentUseCase().setContext(container);

    PaymentService.init(
      process,
      createInvoice,
      retry,
      new GetPaymentUseCase().setContext(container),
      new ListPaymentsUseCase().setContext(container),
      new ListPaymentsByStatusUseCase().setContext(container),
      new GetInvoiceUseCase().setContext(container),
      new ListInvoicesUseCase().setContext(container),
      new ListInvoicesByStatusUseCase().setContext(container),
      new IssueInvoiceUseCase().setContext(container),
      new CancelInvoiceUseCase().setContext(container),
    );
    service = PaymentService.getInstance();
  });

  afterAll(() => {
    sqlite?.close();
  });

  let userSeq = 0;

  async function seedUser(): Promise<number> {
    userSeq++;
    const result = await db
      .insert(userTable)
      .values({
        name: `User ${userSeq}`,
        username: `pay_user_${Date.now()}_${userSeq}`,
        email: `pay_${userSeq}@test.com`,
        password: "hash",
      })
      .returning({ id: userTable.id });
    return result[0].id!;
  }

  it("creates an invoice in the database", async () => {
    const userId = await seedUser();

    const invoice = await service.createInvoice({
      userId,
      items: [
        { description: "Product A", quantity: 2, unitPrice: 25000 },
        { description: "Product B", quantity: 1, unitPrice: 10000 },
      ],
      currency: "IDR",
      tax: 5000,
    });

    expect(invoice.id).toBeDefined();
    expect(invoice.subtotal).toBe(60000);
    expect(invoice.totalAmount).toBe(65000);

    const row = await db.select().from(invoiceTable).where(eq(invoiceTable.id, invoice.id!)).get();
    expect(row?.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(JSON.parse(row!.items as string)).toHaveLength(2);
  });

  it("processes a payment and persists completed status", async () => {
    const userId = await seedUser();
    const invoice = await service.createInvoice({
      userId,
      items: [{ description: "P", quantity: 1, unitPrice: 100000 }],
      currency: "IDR",
    });

    const payment = await service.processPayment({
      userId,
      amount: invoice.totalAmount,
      currency: invoice.currency,
      method: "bank_transfer",
      invoiceId: invoice.id,
    });

    expect(payment.id).toBeDefined();
    expect(payment.status).toBe("completed");
    expect(payment.gatewayRef).toMatch(/^mock_/);

    const row = await db.select().from(paymentTable).where(eq(paymentTable.id, payment.id!)).get();
    expect(row?.status).toBe("completed");
    expect(row?.invoiceId).toBe(invoice.id);
    expect(row?.method).toBe("bank_transfer");
  });

  it("listPayments and listPaymentsByStatus read from DB", async () => {
    const userId = await seedUser();

    await service.processPayment({
      userId,
      amount: 1000,
      currency: "IDR",
      method: "cash",
    });
    await service.processPayment({
      userId,
      amount: 2000,
      currency: "IDR",
      method: "ewallet",
    });

    const all = await service.listPayments(ID.new(userId));
    expect(all.length).toBeGreaterThanOrEqual(2);

    const completed = await service.listPaymentsByStatus("completed", ID.new(userId));
    expect(completed).toHaveLength(2);
  });

  it("marks payment failed when gateway declines", async () => {
    const userId = await seedUser();
    const payment = await service.processPayment({
      userId,
      amount: 999999999,
      currency: "IDR",
      method: "credit_card",
    });

    expect(payment.status).toBe("failed");
    expect(payment.metadata?.lastError).toBe("Credit card payment limit exceeded");
  });

  it("retries a failed payment to completion", async () => {
    const userId = await seedUser();
    gateway.failNext(1);
    const failed = await service.processPayment({
      userId,
      amount: 1000,
      currency: "IDR",
      method: "cash",
    });
    expect(failed.status).toBe("failed");

    const retried = await service.retryPayment(ID.new(failed.id!), ID.new(userId));
    expect(retried.status).toBe("completed");
    expect(retried.retryCount).toBe(1);
  });

  it("throws exhaust error retrying a completed payment", async () => {
    const userId = await seedUser();
    const ok = await service.processPayment({
      userId,
      amount: 1000,
      currency: "IDR",
      method: "cash",
    });

    await expect(service.retryPayment(ID.new(ok.id!), ID.new(userId))).rejects.toThrow(
      PaymentRetryExhaustedError,
    );
  });

  it("issues an invoice through the service", async () => {
    const userId = await seedUser();
    const invoice = await service.createInvoice({
      userId,
      items: [{ description: "P", quantity: 1, unitPrice: 5000 }],
      currency: "IDR",
    });

    const issued = await service.issueInvoice(ID.new(invoice.id!), ID.new(userId));
    expect(issued.status).toBe("issued");

    const row = await db.select().from(invoiceTable).where(eq(invoiceTable.id, invoice.id!)).get();
    expect(row?.status).toBe("issued");
  });
});