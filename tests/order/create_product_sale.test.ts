import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setDB, setD1 } from "$services/shared/infra/db";
import { orderTable } from "$services/shared/infra/db/drizzle-schema/order.schema";
import { productTable } from "$services/shared/infra/db/drizzle-schema/product.schema";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { assetTable } from "$services/shared/infra/db/drizzle-schema/asset.schema";
import { contactTable } from "$services/shared/infra/db/drizzle-schema/contact.schema";
import { createOrderService, OrderService } from "$services/domain/order";
import { OrderRepositoryImpl } from "$services/domain/order/adapters/driven/drizzle/order.repository";
import { ProductRepositoryImpl } from "$services/domain/products/adapters/driven/drizzle/product.repository";
import { TransactionRepositoryImpl } from "$services/domain/transactions/adapters/driven/drizzle/transaction.repository";
import { AssetRepositoryImpl } from "$services/domain/assets/adapters/driven/drizzle/asset.repository";
import { UnitOfWorkImpl } from "$services/domain/assets/adapters/driven/drizzle/uow.repository";
import { OutboxRepositoryImpl } from "$services/shared/infra/db/drizzle/outbox.repository";
import { createProductService } from "$services/domain/products";
import { createTransactionService } from "$services/domain/transactions";
import { createAssetService, AssetService } from "$services/domain/assets";
import { ID } from "$services/shared/kernel/id";
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

function initPayment(): PaymentService {
  const paymentRepo = new PaymentRepositoryImpl();
  const invoiceRepo = new InvoiceRepositoryImpl();
  const gateway = new MockPaymentGateway();
  const retryPolicy = RetryPolicy.new();

  const container = new ServiceContainer()
    .set(PaymentRepository, paymentRepo)
    .set(InvoiceRepository, invoiceRepo)
    .set(PaymentGateway, gateway)
    .set(RetryPolicyToken, retryPolicy);

  const processPayment = new ProcessPaymentUseCase().setContext(container);
  const createInvoice = new CreateInvoiceUseCase().setContext(container);
  const retryPayment = new RetryPaymentUseCase().setContext(container);

  PaymentService.init(
    processPayment,
    createInvoice,
    retryPayment,
    new GetPaymentUseCase().setContext(container),
    new ListPaymentsUseCase().setContext(container),
    new ListPaymentsByStatusUseCase().setContext(container),
    new GetInvoiceUseCase().setContext(container),
    new ListInvoicesUseCase().setContext(container),
    new ListInvoicesByStatusUseCase().setContext(container),
    new IssueInvoiceUseCase().setContext(container),
    new CancelInvoiceUseCase().setContext(container),
  );
  return PaymentService.getInstance();
}

describe("createOrderProductSale — real SQLite via D1 mock", () => {
  let sqlite: any;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    db = drizzle(env.d1 as any);
    setDB(db as any);
    setD1(env.d1 as any);

    createOrderService({ orderRepo: new OrderRepositoryImpl(), payment: initPayment() });
    createProductService({ productRepo: new ProductRepositoryImpl() });
    createAssetService({
      assetRepo: new AssetRepositoryImpl(),
      uow: new UnitOfWorkImpl(),
      outboxRepo: new OutboxRepositoryImpl(),
    });
    createTransactionService({
      txRepo: new TransactionRepositoryImpl(),
      assetGateway: AssetService.getInstance(),
    });
  });

  afterAll(() => {
    sqlite?.close();
  });

  let userSeq = 0;

  async function seedUser(username?: string): Promise<number> {
    userSeq++;
    const suffix = `${Date.now()}_${userSeq}`;
    const result = await db
      .insert(userTable)
      .values({
        name: username ?? `test_${suffix}`,
        username: username ?? `user_${suffix}`,
        email: `user_${suffix}@test.com`,
        password: "hash",
      })
      .returning({ id: userTable.id });
    return result[0].id!;
  }

  async function seedProduct(
    userId: number,
    overrides?: { stock?: number; price?: number; capital?: number; trackStock?: boolean },
  ): Promise<number> {
    const result = await db
      .insert(productTable)
      .values({
        userId,
        name: "Coffee",
        price: overrides?.price ?? 25000,
        capital: overrides?.capital ?? 15000,
        currency: "IDR",
        stock: overrides?.stock ?? 50,
        trackStock: (overrides?.trackStock ?? true) ? 1 : 0,
      })
      .returning({ id: productTable.id });
    return result[0].id!;
  }

  async function seedContact(userId: number, id: number): Promise<number> {
    const result = await db
      .insert(contactTable)
      .values({
        id,
        userId,
        name: "Customer",
      })
      .returning({ id: contactTable.id });
    return result[0].id!;
  }

  it("full flow: creates order, deducts stock, inserts transaction", async () => {
    const userId = await seedUser();
    const productDbId = await seedProduct(userId);
    const productId = ID.new(productDbId);
    const customerId = await seedContact(userId, 5);

    const order = await OrderService.getInstance().createOrderProductSale({
      userId,
      productId,
      itemCount: 2,
      price: 50000,
      currency: "IDR",
      customerId,
      description: "2 Coffee",
    });

    expect(order.id).toBeDefined();
    expect(order.totalAmount).toBe(100000);
    expect(order.itemCount).toBe(2);
    expect(order.status).toBe("success");

    const updated = await db
      .select()
      .from(productTable)
      .where(eq(productTable.id, productDbId))
      .all();
    expect(updated[0].stock).toBe(48);

    const orders = await db.select().from(orderTable).where(eq(orderTable.userId, userId)).all();
    expect(orders.length).toBe(1);
    expect(orders[0].description).toBe("2 Coffee");
    expect(orders[0].paymentMethod).toBe("cash");
  });

  it("creates product sale with bank_transfer payment and asset mutation", async () => {
    const userId = await seedUser();
    const productDbId = await seedProduct(userId);
    const productId = ID.new(productDbId);

    const assetResult = await db
      .insert(assetTable)
      .values({
        userId,
        name: "Bank Account",
        type: "bank",
        balance: 1_000_000,
        currency: "IDR",
      })
      .returning({ id: assetTable.id });
    const assetIdNum = assetResult[0].id!;
    const customerId = await seedContact(userId, 3);

    const order = await OrderService.getInstance().createOrderProductSale({
      userId,
      productId,
      itemCount: 1,
      price: 25000,
      currency: "IDR",
      paymentMethod: "bank_transfer",
      customerId,
      payToAssetId: assetIdNum,
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe("success");
    expect(order.paymentMethod).toBe("bank_transfer");

    const updatedAsset = await db
      .select()
      .from(assetTable)
      .where(eq(assetTable.id, assetIdNum))
      .all();
    expect(updatedAsset[0].balance).toBe(1_025_000);
  });

  it("throws when product not found", async () => {
    await expect(
      OrderService.getInstance().createOrderProductSale({
        userId: 1,
        productId: ID.new(9999),
        itemCount: 1,
        price: 100,
        currency: "IDR",
      }),
    ).rejects.toThrow("Product with id 9999 not found");
  });

  it("throws when product belongs to another user", async () => {
    const uid1 = await seedUser();
    const uid2 = await seedUser();
    const productDbId = await seedProduct(uid2);
    const productId = ID.new(productDbId);

    await expect(
      OrderService.getInstance().createOrderProductSale({
        userId: uid1,
        productId,
        itemCount: 1,
        price: 25000,
        currency: "IDR",
      }),
    ).rejects.toThrow(`Product with id ${productDbId} not found`);
  });

  it("throws when insufficient stock", async () => {
    const userId = await seedUser();
    const productDbId = await seedProduct(userId, { stock: 1 });
    const productId = ID.new(productDbId);

    await expect(
      OrderService.getInstance().createOrderProductSale({
        userId,
        productId,
        itemCount: 5,
        price: 125000,
        currency: "IDR",
      }),
    ).rejects.toThrow("Insufficient stock");
  });

  it("allows sale without stock validation when trackStock is disabled", async () => {
    const userId = await seedUser();
    const productDbId = await seedProduct(userId, {
      stock: 1,
      trackStock: false,
    });
    const productId = ID.new(productDbId);

    const order = await OrderService.getInstance().createOrderProductSale({
      userId,
      productId,
      itemCount: 10,
      price: 5000,
      currency: "IDR",
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe("success");

    const updated = await db
      .select()
      .from(productTable)
      .where(eq(productTable.id, productDbId))
      .all();
    expect(updated[0].stock).toBe(1);
  });
});
