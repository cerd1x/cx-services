import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type InvoiceDto = {
  id: string;
  invoiceNumber: string;
  status: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  totalAmount: number;
  currency: string;
};

type PaymentDto = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  invoiceId: string | null;
};

describe("payment e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("creates, issues, and cancels invoices", async () => {
    const { session } = await signUpUser();

    const create = await gql<{ createInvoice: InvoiceDto }>(
      `mutation($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { id invoiceNumber status items { description quantity unitPrice } subtotal totalAmount currency }
      }`,
      {
        input: {
          items: [{ description: "Jasa Konsultasi", quantity: 2, unitPrice: 50000 }],
          currency: "IDR",
          tax: 0,
        },
      },
      authHeaders(session),
    );
    expect(create.errors).toBeUndefined();
    expect(create.data!.createInvoice.status).toBe("draft");
    expect(create.data!.createInvoice.subtotal).toBe(100000);
    expect(create.data!.createInvoice.totalAmount).toBe(100000);
    expect(create.data!.createInvoice.items).toHaveLength(1);
    const invoiceId = create.data!.createInvoice.id;

    const list = await gql<{ invoices: InvoiceDto[] }>(
      `{ invoices { id invoiceNumber status totalAmount } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.errors).toBeUndefined();
    expect(list.data!.invoices.some((i) => i.id === invoiceId)).toBe(true);

    const issued = await gql<{ issueInvoice: InvoiceDto }>(
      `mutation($id: ID!) { issueInvoice(id: $id) { id status } }`,
      { id: invoiceId },
      authHeaders(session),
    );
    expect(issued.errors).toBeUndefined();
    expect(issued.data!.issueInvoice.status).toBe("issued");

    const get = await gql<{ invoice: InvoiceDto }>(
      `query($id: ID!) { invoice(id: $id) { id status subtotal totalAmount } }`,
      { id: invoiceId },
      authHeaders(session),
    );
    expect(get.errors).toBeUndefined();
    expect(get.data!.invoice.subtotal).toBe(100000);

    const cancelled = await gql<{ cancelInvoice: InvoiceDto }>(
      `mutation($id: ID!) { cancelInvoice(id: $id) { id status } }`,
      { id: invoiceId },
      authHeaders(session),
    );
    expect(cancelled.errors).toBeUndefined();
    expect(cancelled.data!.cancelInvoice.status).toBe("cancelled");
  });

  it("processes a payment and lists payments by status", async () => {
    const { session } = await signUpUser();

    const invoice = await gql<{ createInvoice: InvoiceDto }>(
      `mutation($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { id status totalAmount currency }
      }`,
      {
        input: {
          items: [{ description: "Produk A", quantity: 1, unitPrice: 75000 }],
          currency: "IDR",
        },
      },
      authHeaders(session),
    );
    expect(invoice.errors).toBeUndefined();
    const invoiceId = invoice.data!.createInvoice.id;

    await gql(`mutation($id: ID!) { issueInvoice(id: $id) { id status } }`, { id: invoiceId }, authHeaders(session));

    const paid = await gql<{ processPayment: PaymentDto }>(
      `mutation($input: ProcessPaymentInput!) {
        processPayment(input: $input) { id amount currency method status invoiceId }
      }`,
      {
        input: { amount: 75000, currency: "IDR", method: "cash", invoiceId },
      },
      authHeaders(session),
    );
    expect(paid.errors).toBeUndefined();
    expect(paid.data!.processPayment.amount).toBe(75000);
    expect(paid.data!.processPayment.invoiceId).toBe(invoiceId);
    const paymentId = paid.data!.processPayment.id;

    const byStatus = await gql<{ paymentsByStatus: PaymentDto[] }>(
      `query($status: PaymentStatusEnum!) { paymentsByStatus(status: $status) { id status } }`,
      { status: "completed" },
      authHeaders(session),
    );
    expect(byStatus.errors).toBeUndefined();
    expect(byStatus.data!.paymentsByStatus.some((p) => p.id === paymentId)).toBe(true);

    const get = await gql<{ payment: PaymentDto }>(
      `query($id: ID!) { payment(id: $id) { id amount method status } }`,
      { id: paymentId },
      authHeaders(session),
    );
    expect(get.errors).toBeUndefined();
    expect(get.data!.payment.status).toBe(paid.data!.processPayment.status);

    const all = await gql<{ payments: PaymentDto[] }>(
      `{ payments { id amount status } }`,
      undefined,
      authHeaders(session),
    );
    expect(all.errors).toBeUndefined();
    expect(all.data!.payments.some((p) => p.id === paymentId)).toBe(true);
  });
});