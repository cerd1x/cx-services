import { ID } from "$services/shared/kernel";
import { z } from "zod";

const PaymentStatus = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  refunded: "refunded",
  cancelled: "cancelled",
} as const;

type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

const PaymentMethodType = {
  cash: "cash",
  bankTransfer: "bank_transfer",
  ewallet: "ewallet",
  creditCard: "credit_card",
  debitCard: "debit_card",
  credit: "credit",
} as const;

type PaymentMethodType = (typeof PaymentMethodType)[keyof typeof PaymentMethodType];

const paymentStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded",
  "cancelled",
]);

const paymentMethodTypeSchema = z.enum([
  "cash",
  "bank_transfer",
  "ewallet",
  "credit_card",
  "debit_card",
  "credit",
]);

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["completed", "failed"],
  completed: ["refunded"],
  failed: ["pending"],
  refunded: [],
  cancelled: [],
};

export const paymentSchema = z.object({
  id: z.number().optional(),
  userId: z.number(),
  invoiceId: z.number().optional(),
  amount: z.number().positive("Amount must be greater than zero"),
  currency: z.string().length(3, "Currency must be 3-letter ISO code"),
  method: paymentMethodTypeSchema,
  status: paymentStatusSchema.default("pending"),
  gatewayRef: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  retryCount: z.number().min(0).max(3).default(0),
  maxRetries: z.number().min(0).max(5).default(3),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export type PaymentData = z.infer<typeof paymentSchema>;
export type PaymentUpdateData = Partial<
  Pick<PaymentData, "status" | "gatewayRef" | "description" | "metadata" | "retryCount">
>;

const amountSchema = paymentSchema.shape.amount;
const statusSchema = paymentSchema.shape.status;
const methodSchema = paymentSchema.shape.method;
const currencySchema = paymentSchema.shape.currency;

export class Payment {
  id?: ID;
  userId!: number;
  invoiceId?: number;
  amount!: number;
  currency!: string;
  method!: PaymentMethodType;
  status: PaymentStatus = "pending";
  gatewayRef?: string;
  description?: string;
  retryCount: number = 0;
  maxRetries: number = 3;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    userId: number;
    amount: number;
    currency: string;
    method: PaymentMethodType;
    invoiceId?: number;
    status?: PaymentStatus;
    gatewayRef?: string;
    description?: string;
    retryCount?: number;
    maxRetries?: number;
    metadata?: Record<string, unknown>;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.userId = data.userId;
    this.amount = data.amount;
    this.currency = data.currency;
    this.method = data.method;
    this.invoiceId = data.invoiceId;
    if (data.status) this.status = data.status;
    this.gatewayRef = data.gatewayRef;
    this.description = data.description;
    if (data.retryCount !== undefined) this.retryCount = data.retryCount;
    if (data.maxRetries !== undefined) this.maxRetries = data.maxRetries;
    this.metadata = data.metadata;
    this.id = data.id ? ID.new(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static new(data: {
    userId: number;
    amount: number;
    currency: string;
    method: PaymentMethodType;
    invoiceId?: number;
    description?: string;
    maxRetries?: number;
    metadata?: Record<string, unknown>;
  }): Payment {
    return new Payment({ ...data });
  }

  canTransitionTo(target: PaymentStatus): boolean {
    const allowed = VALID_TRANSITIONS[this.status];
    return allowed.includes(target);
  }

  transitionTo(target: PaymentStatus): Payment {
    if (!this.canTransitionTo(target)) {
      throw new Error(
        `Invalid status transition: ${this.status} -> ${target}. Allowed: ${VALID_TRANSITIONS[this.status].join(", ") || "none"}`,
      );
    }
    this.status = target;
    return this;
  }

  canRetry(): boolean {
    return this.status === "failed" && this.retryCount < this.maxRetries;
  }

  incrementRetry(): Payment {
    if (!this.canRetry()) {
      throw new Error(
        `Cannot retry: status=${this.status}, retryCount=${this.retryCount}/${this.maxRetries}`,
      );
    }
    this.retryCount += 1;
    this.status = "pending";
    return this;
  }

  validateAmount(): Payment {
    const result = amountSchema.safeParse(this.amount);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateCurrency(): Payment {
    const result = currencySchema.safeParse(this.currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateStatus(): Payment {
    const result = statusSchema.safeParse(this.status);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateMethod(): Payment {
    const result = methodSchema.safeParse(this.method);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateAll(): Payment {
    return this.validateAmount().validateCurrency().validateStatus().validateMethod();
  }
}

export { PaymentStatus, PaymentMethodType };
