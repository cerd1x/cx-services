import { ID } from "$services/shared/kernel";
import { z } from "zod";

const InvoiceStatus = {
  draft: "draft",
  issued: "issued",
  paid: "paid",
  partiallyPaid: "partially_paid",
  overdue: "overdue",
  cancelled: "cancelled",
} as const;

type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

const invoiceStatusSchema = z.enum([
  "draft",
  "issued",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
]);

const INVOICE_ITEM_SCHEMA = z.object({
  description: z.string().min(1, "Item description is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Unit price must be positive"),
});

export type InvoiceItem = z.infer<typeof INVOICE_ITEM_SCHEMA>;

export const invoiceSchema = z.object({
  id: z.number().optional(),
  userId: z.number(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  customerId: z.number().optional(),
  items: z.array(INVOICE_ITEM_SCHEMA).min(1, "At least one item is required"),
  subtotal: z.number().positive("Subtotal must be positive"),
  tax: z.number().min(0, "Tax cannot be negative").default(0),
  totalAmount: z.number().positive("Total amount must be positive"),
  currency: z.string().length(3, "Currency must be 3-letter ISO code"),
  status: invoiceStatusSchema.default("draft"),
  issuedAt: z.date().optional(),
  dueAt: z.date().optional(),
  paidAt: z.date().optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export type InvoiceData = z.infer<typeof invoiceSchema>;
export type InvoiceUpdateData = Partial<
  Pick<InvoiceData, "status" | "customerId" | "description" | "dueAt" | "metadata">
>;

const statusSchema = invoiceSchema.shape.status;
const totalAmountSchema = invoiceSchema.shape.totalAmount;
const currencySchema = invoiceSchema.shape.currency;

export class Invoice {
  id?: ID;
  userId!: number;
  invoiceNumber!: string;
  customerId?: number;
  items!: InvoiceItem[];
  subtotal!: number;
  tax!: number;
  totalAmount!: number;
  currency!: string;
  status: InvoiceStatus = "draft";
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    userId: number;
    invoiceNumber: string;
    items: InvoiceItem[];
    subtotal: number;
    tax: number;
    totalAmount: number;
    currency: string;
    customerId?: number;
    status?: InvoiceStatus;
    issuedAt?: Date;
    dueAt?: Date;
    paidAt?: Date;
    description?: string;
    metadata?: Record<string, unknown>;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.userId = data.userId;
    this.invoiceNumber = data.invoiceNumber;
    this.items = data.items;
    this.subtotal = data.subtotal;
    this.tax = data.tax;
    this.totalAmount = data.totalAmount;
    this.currency = data.currency;
    this.customerId = data.customerId;
    if (data.status) this.status = data.status;
    this.issuedAt = data.issuedAt;
    this.dueAt = data.dueAt;
    this.paidAt = data.paidAt;
    this.description = data.description;
    this.metadata = data.metadata;
    this.id = data.id ? ID.new(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static new(data: {
    userId: number;
    invoiceNumber: string;
    items: InvoiceItem[];
    currency: string;
    customerId?: number;
    tax?: number;
    status?: InvoiceStatus;
    dueAt?: Date;
    description?: string;
  }): Invoice {
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = data.tax ?? 0;
    const totalAmount = subtotal + tax;

    return new Invoice({
      ...data,
      subtotal,
      tax,
      totalAmount,
      status: data.status ?? "draft",
    });
  }

  static calculateTotal(
    items: InvoiceItem[],
    tax: number = 0,
  ): { subtotal: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return { subtotal, total: subtotal + tax };
  }

  isOverdue(): boolean {
    if (!this.dueAt || this.status === "cancelled" || this.status === "paid") {
      return false;
    }
    return new Date() > this.dueAt;
  }

  markAsIssued(): Invoice {
    if (this.status !== "draft") {
      throw new Error(`Cannot issue invoice in status: ${this.status}`);
    }
    this.status = "issued";
    this.issuedAt = new Date();
    return this;
  }

  markAsPaid(): Invoice {
    if (this.status !== "issued" && this.status !== "partially_paid") {
      throw new Error(`Cannot mark invoice as paid in status: ${this.status}`);
    }
    this.status = "paid";
    this.paidAt = new Date();
    return this;
  }

  markAsCancelled(): Invoice {
    if (this.status === "paid") {
      throw new Error("Cannot cancel a paid invoice");
    }
    this.status = "cancelled";
    return this;
  }

  toData(): InvoiceData {
    return {
      id: this.id?.toNumb,
      userId: this.userId,
      invoiceNumber: this.invoiceNumber,
      customerId: this.customerId,
      items: this.items,
      subtotal: this.subtotal,
      tax: this.tax,
      totalAmount: this.totalAmount,
      currency: this.currency,
      status: this.status,
      issuedAt: this.issuedAt,
      dueAt: this.dueAt,
      paidAt: this.paidAt,
      description: this.description,
      metadata: this.metadata,
      createdAt: this.createdAt ?? new Date(),
      updatedAt: this.updatedAt,
    };
  }

  validateStatus(): Invoice {
    const result = statusSchema.safeParse(this.status);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateAmount(): Invoice {
    const result = totalAmountSchema.safeParse(this.totalAmount);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateCurrency(): Invoice {
    const result = currencySchema.safeParse(this.currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateAll(): Invoice {
    return this.validateAmount().validateCurrency().validateStatus();
  }
}

export { InvoiceStatus };
