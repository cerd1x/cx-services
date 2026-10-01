import { Balance } from "../../../../assets/core/value-objects/balance.vo";
import { ID } from "$services/shared/kernel";
import { z } from "zod";

const TransactionType = {
  income: "income",
  expense: "expense",
  transfer: "transfer",
  outcome: "outcome",
} as const;

type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

const TransactionStatus = {
  pending: "pending",
  success: "success",
  failed: "failed",
} as const;

type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

const PaymentMethodType = {
  cash: "cash",
  bankTransfer: "bank_transfer",
  ewallet: "ewallet",
  creditCard: "credit_card",
  debitCard: "debit_card",
  credit: "credit",
} as const;

type PaymentMethodType = (typeof PaymentMethodType)[keyof typeof PaymentMethodType];

const paymentMethodTypeSchema = z.enum([
  "cash",
  "bank_transfer",
  "ewallet",
  "credit_card",
  "debit_card",
  "credit",
]);

export const paymentMethodSchema = z.object({
  type: paymentMethodTypeSchema,
  assetId: z.number().optional(),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const transactionSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  type: z.enum(["income", "expense", "transfer", "outcome"]),
  status: z.enum(["pending", "success", "failed"]).default("pending"),
  paymentMethod: paymentMethodSchema.default({ type: "cash" }),
  customerId: z.number().optional(),
  amount: z.number().positive("Amount must be positive"),
  capital: z.number().positive("Capital must be positive"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  category: z.string().max(100, "Category must be at most 100 characters").optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export type TransactionData = z.infer<typeof transactionSchema>;
export type TransactionUpdateData = Partial<
  Pick<
    TransactionData,
    "type" | "status" | "paymentMethod" | "description" | "category" | "customerId"
  >
>;

const typeSchema = transactionSchema.shape.type;
const statusSchema = transactionSchema.shape.status;
const descriptionSchema = transactionSchema.shape.description;
const categorySchema = transactionSchema.shape.category;
export class Transaction {
  id?: ID;
  userId?: number;
  type!: TransactionType;
  status: TransactionStatus = "pending";
  paymentMethod: PaymentMethod = { type: "cash" };
  customerId?: number;
  amount!: Balance;
  capital!: Balance;
  description?: string;
  category?: string;
  createdAt?: Date;
  updatedAt?: Date;

  #currency!: string;

  constructor(data: {
    type: TransactionType;
    userId?: number;
    amount: Balance;
    capital: Balance;
    description?: string;
    category?: string;
    status?: TransactionStatus;
    paymentMethod?: PaymentMethod;
    customerId?: number;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.type = data.type;
    this.userId = data.userId;
    this.amount = data.amount;
    this.capital = data.capital;
    this.description = data.description;
    this.category = data.category;
    if (data.status) this.status = data.status;
    if (data.paymentMethod) this.paymentMethod = data.paymentMethod;
    this.customerId = data.customerId;
    this.id = data.id ? ID.new(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get currency(): string {
    return this.#currency;
  }

  static new(data: {
    type: TransactionType;
    userId?: number;
    amount: Balance;
    capital: Balance;
    createdAt?: Date;
    description?: string;
    category?: string;
    status?: TransactionStatus;
    paymentMethod?: PaymentMethod;
    customerId?: number;
  }): Transaction {
    return new Transaction({ ...data });
  }

  validateType(): Transaction {
    const result = typeSchema.safeParse(this.type);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateDescription(): Transaction {
    if (this.description !== undefined) {
      const result = descriptionSchema.safeParse(this.description);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateCategory(): Transaction {
    if (this.category !== undefined) {
      const result = categorySchema.safeParse(this.category);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateStatus(): Transaction {
    const result = statusSchema.safeParse(this.status);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validatePaymentMethod(): Transaction {
    const result = paymentMethodSchema.safeParse(this.paymentMethod);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateAll(): Transaction {
    return this.validateType()
      .validateDescription()
      .validateCategory()
      .validateStatus()
      .validatePaymentMethod();
  }
}

export { TransactionType, TransactionStatus, PaymentMethodType };
