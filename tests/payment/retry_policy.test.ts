import { describe, expect, it } from "bun:test";
import { RetryPolicy } from "$services/domain/payment/core/value-objects/retry-policy.vo";
import {
  Payment,
  PaymentStatus,
  PaymentMethodType,
} from "$services/domain/payment/core/entity/payment.entity";
import { Invoice } from "$services/domain/payment/core/entity/invoice.entity";

describe("RetryPolicy", () => {
  it("uses default config when constructed without args", () => {
    const policy = RetryPolicy.new();
    expect(policy.maxRetries).toBe(3);
    expect(policy.baseDelayMs).toBe(1000);
  });

  it("allows override of config", () => {
    const policy = RetryPolicy.new({ maxRetries: 5, baseDelayMs: 500 });
    expect(policy.maxRetries).toBe(5);
    expect(policy.baseDelayMs).toBe(500);
  });

  it("shouldRetry returns true below max, false at/above max", () => {
    const policy = RetryPolicy.new({ maxRetries: 3 });
    expect(policy.shouldRetry(0)).toBe(true);
    expect(policy.shouldRetry(2)).toBe(true);
    expect(policy.shouldRetry(3)).toBe(false);
    expect(policy.shouldRetry(4)).toBe(false);
  });

  it("calculateDelay applies exponential backoff", () => {
    const policy = RetryPolicy.new({ baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000 });
    expect(policy.calculateDelay(1)).toBe(1000);
    expect(policy.calculateDelay(2)).toBe(2000);
    expect(policy.calculateDelay(3)).toBe(4000);
  });

  it("caps delay at maxDelayMs", () => {
    const policy = RetryPolicy.new({ baseDelayMs: 10000, maxDelayMs: 30000, backoffMultiplier: 2 });
    expect(policy.calculateDelay(5)).toBe(30000);
  });

  it("getNextRetryDelay returns -1 when retries exhausted", () => {
    const policy = RetryPolicy.new({ maxRetries: 2 });
    expect(policy.getNextRetryDelay(2)).toBe(-1);
    expect(policy.getNextRetryDelay(1)).toBeGreaterThan(0);
  });
});

describe("Payment entity", () => {
  const valid = {
    userId: 1,
    amount: 50000,
    currency: "IDR",
    method: PaymentMethodType.ewallet as "ewallet",
  };

  it("creates a payment with default pending status", () => {
    const payment = Payment.new(valid);
    expect(payment.status).toBe(PaymentStatus.pending);
    expect(payment.retryCount).toBe(0);
    expect(payment.maxRetries).toBe(3);
  });

  it("rejects zero/negative amount", () => {
    expect(() => Payment.new({ ...valid, amount: 0 }).validateAll()).toThrow(
      "Amount must be greater than zero",
    );
    expect(() => Payment.new({ ...valid, amount: -100 }).validateAll()).toThrow(
      "Amount must be greater than zero",
    );
  });

  it("rejects invalid currency code", () => {
    expect(() => Payment.new({ ...valid, currency: "INVALID" }).validateAll()).toThrow();
    expect(() => Payment.new({ ...valid, currency: "ID" }).validateAll()).toThrow();
  });

  it("rejects invalid payment method", () => {
    expect(() => Payment.new({ ...valid, method: "bitcoin" as any }).validateAll()).toThrow(
      /Invalid enum value|Invalid option/,
    );
  });

  describe("status transitions", () => {
    it("allows pending -> processing and processing -> completed", () => {
      const payment = Payment.new(valid);
      payment.transitionTo(PaymentStatus.processing);
      expect(payment.status).toBe(PaymentStatus.processing);
      payment.transitionTo(PaymentStatus.completed);
      expect(payment.status).toBe(PaymentStatus.completed);
    });

    it("allows processing -> failed and failed -> pending", () => {
      const payment = Payment.new(valid);
      payment.transitionTo(PaymentStatus.processing);
      payment.transitionTo(PaymentStatus.failed);
      expect(payment.status).toBe(PaymentStatus.failed);
      payment.transitionTo(PaymentStatus.pending);
      expect(payment.status).toBe(PaymentStatus.pending);
    });

    it("allows completed -> refunded", () => {
      const payment = Payment.new(valid);
      payment.transitionTo(PaymentStatus.processing);
      payment.transitionTo(PaymentStatus.completed);
      payment.transitionTo(PaymentStatus.refunded);
      expect(payment.status).toBe(PaymentStatus.refunded);
    });

    it("blocks invalid transitions", () => {
      const payment = Payment.new(valid);
      expect(() => payment.transitionTo(PaymentStatus.completed)).toThrow(
        /Invalid status transition/,
      );
      expect(() => payment.transitionTo(PaymentStatus.refunded)).toThrow(
        /Invalid status transition/,
      );
    });
  });

  describe("retry rules", () => {
    it("canRetry only when failed and below max", () => {
      const payment = Payment.new(valid);
      expect(payment.canRetry()).toBe(false);

      payment.transitionTo(PaymentStatus.processing);
      payment.transitionTo(PaymentStatus.failed);
      expect(payment.canRetry()).toBe(true);
    });

    it("incrementRetry increases count and resets to pending", () => {
      const payment = Payment.new(valid);
      payment.transitionTo(PaymentStatus.processing);
      payment.transitionTo(PaymentStatus.failed);
      payment.incrementRetry();
      expect(payment.retryCount).toBe(1);
      expect(payment.status).toBe(PaymentStatus.pending);
    });

    it("stops retrying after maxRetries exhausted", () => {
      const payment = Payment.new(valid);
      payment.maxRetries = 2;
      for (let i = 0; i < 2; i++) {
        payment.transitionTo(PaymentStatus.processing);
        payment.transitionTo(PaymentStatus.failed);
        payment.incrementRetry();
      }
      payment.transitionTo(PaymentStatus.processing);
      payment.transitionTo(PaymentStatus.failed);
      expect(payment.canRetry()).toBe(false);
      expect(() => payment.incrementRetry()).toThrow(/Cannot retry/);
    });
  });
});

describe("Invoice entity", () => {
  const sampleItems = [
    { description: "Item A", quantity: 2, unitPrice: 1000 },
    { description: "Item B", quantity: 1, unitPrice: 5000 },
  ];

  it("computes subtotal and total amount from items", () => {
    const invoice = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-001",
      items: sampleItems,
      currency: "IDR",
      tax: 2000,
    });

    expect(invoice.subtotal).toBe(7000);
    expect(invoice.tax).toBe(2000);
    expect(invoice.totalAmount).toBe(9000);
    expect(invoice.status).toBe("draft");
  });

  it("defaults tax to 0 and status to draft", () => {
    const invoice = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-002",
      items: sampleItems,
      currency: "IDR",
    });
    expect(invoice.tax).toBe(0);
    expect(invoice.totalAmount).toBe(7000);
    expect(invoice.status).toBe("draft");
  });

  it("isOverdue returns true only past dueAt for active invoices", () => {
    const overdue = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-003",
      items: sampleItems,
      currency: "IDR",
      dueAt: new Date(Date.now() - 1000),
    });
    expect(overdue.isOverdue()).toBe(true);

    const future = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-004",
      items: sampleItems,
      currency: "IDR",
      dueAt: new Date(Date.now() + 1000 * 60),
    });
    expect(future.isOverdue()).toBe(false);
  });

  it("markAsIssued only from draft", () => {
    const invoice = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-005",
      items: sampleItems,
      currency: "IDR",
    });
    invoice.markAsIssued();
    expect(invoice.status).toBe("issued");
    expect(invoice.issuedAt).toBeDefined();

    expect(() => invoice.markAsIssued()).toThrow(/Cannot issue/);
  });

  it("markAsPaid only from issued", () => {
    const invoice = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-006",
      items: sampleItems,
      currency: "IDR",
    });
    expect(() => invoice.markAsPaid()).toThrow(/Cannot mark invoice as paid/);

    invoice.markAsIssued();
    invoice.markAsPaid();
    expect(invoice.status).toBe("paid");
    expect(invoice.paidAt).toBeDefined();
  });

  it("cannot cancel a paid invoice", () => {
    const invoice = Invoice.new({
      userId: 1,
      invoiceNumber: "INV-007",
      items: sampleItems,
      currency: "IDR",
    });
    invoice.markAsIssued();
    invoice.markAsPaid();
    expect(() => invoice.markAsCancelled()).toThrow(/Cannot cancel a paid invoice/);
  });
});
