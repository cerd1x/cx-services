import { Money } from "@lib/money";
import { ID } from "$services/shared/kernel";
import { z } from "zod";

const OrderStatus = {
  pending: "pending",
  success: "success",
  cancelled: "cancelled",
} as const;

type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

const currencySchema = z
  .string()
  .length(3, "Currency must be a 3-letter code")
  .toUpperCase();
const priceSchema = z.custom<Money>(
  (value) => value instanceof Money && value.isPositive(),
  "Price must be positive",
);

export const orderSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  productId: z.number().optional(),
  status: z.enum(["pending", "success", "cancelled"]).default("pending"),
  paymentMethod: z
    .enum([
      "cash",
      "bank_transfer",
      "ewallet",
      "credit_card",
      "debit_card",
      "credit",
    ])
    .default("cash"),
  price: priceSchema,
  paidAmount: priceSchema.optional(),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]).default("unpaid"),
  itemCount: z.number().int().positive("Item count must be positive"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  customerId: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type OrderType = z.infer<typeof orderSchema>;

const statusSchema = orderSchema.shape.status;
const paymentMethodSchema = orderSchema.shape.paymentMethod;
const paymentStatusSchema = orderSchema.shape.paymentStatus;
const paidAmountSchema = z.custom<Money>(
  (v) => v instanceof Money,
  "paidAmount must be a Money instance",
);
const itemCountSchema = orderSchema.shape.itemCount;
const descriptionSchema = orderSchema.shape.description;

export class Order {
  id?: ID;
  userId?: number;
  productId?: number;
  status: OrderStatus = "pending";
  paymentMethod: string = "cash";
  price!: Money;
  paidAmount!: Money;
  paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
  itemCount!: number;
  description?: string;
  customerId?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    price: Money;
    paidAmount?: Money;
    paymentStatus?: "unpaid" | "partial" | "paid";
    itemCount: number;
    userId?: number;
    productId?: number;
    status?: OrderStatus;
    paymentMethod?: string;
    description?: string;
    customerId?: number;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.price = data.price;
    this.itemCount = data.itemCount;
    this.userId = data.userId;
    this.productId = data.productId;
    this.paidAmount = data.paidAmount ?? Money.zero(this.price.currency);
    if (data.status) this.status = data.status;
    if (data.paymentMethod) this.paymentMethod = data.paymentMethod;
    if (data.paymentStatus) this.paymentStatus = data.paymentStatus;
    this.description = data.description;
    this.customerId = data.customerId;
    this.id = data.id ? ID.order(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get totalAmount(): Money {
    return this.price.multiply(this.itemCount);
  }

  get currency(): string {
    return this.price.currency.code.toUpperCase();
  }

  get outstandingAmount(): Money {
    const total = this.totalAmount;
    return total.subtract(this.paidAmount).isPositive()
      ? total.subtract(this.paidAmount)
      : Money.zero(this.price.currency);
  }

  get isPaid(): boolean {
    return this.paymentStatus === "paid";
  }

  get isDebt(): boolean {
    return this.outstandingAmount.isPositive();
  }

  markPaid(amount?: Money): Order {
    const total = this.totalAmount;
    const newPaid = amount ? this.paidAmount.add(amount) : total;
    const next = newPaid.isNegative()
      ? Money.zero(this.price.currency)
      : newPaid;
    this.paidAmount = next.lt(total) ? next : total;
    if (this.paidAmount.equals(total)) {
      this.paymentStatus = "paid";
    } else if (this.paidAmount.isPositive()) {
      this.paymentStatus = "partial";
    } else {
      this.paymentStatus = "unpaid";
    }
    return this;
  }

  static new(data: {
    price: Money;
    paidAmount?: Money;
    paymentStatus?: "unpaid" | "partial" | "paid";
    itemCount: number;
    userId?: number;
    productId?: number;
    status?: OrderStatus;
    paymentMethod?: string;
    description?: string;
    customerId?: number;
  }): Order {
    return new Order(data);
  }

  validateStatus(): Order {
    const result = statusSchema.safeParse(this.status);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validatePaymentMethod(): Order {
    const result = paymentMethodSchema.safeParse(this.paymentMethod);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validatePrice(): Order {
    const result = priceSchema.safeParse(this.price);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  getTotalAmount(): Money {
    return this.totalAmount;
  }

  validateCurrency(): Order {
    const result = currencySchema.safeParse(this.currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateItemCount(): Order {
    const result = itemCountSchema.safeParse(this.itemCount);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateDescription(): Order {
    if (this.description !== undefined) {
      const result = descriptionSchema.safeParse(this.description);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validatePaymentStatus(): Order {
    const result = paymentStatusSchema.safeParse(this.paymentStatus);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    if (this.paidAmount !== undefined) {
      const amountResult = paidAmountSchema.safeParse(this.paidAmount);
      if (!amountResult.success) {
        throw new Error(
          amountResult.error.issues.map((i) => i.message).join(", "),
        );
      }
    }
    return this;
  }

  validateAll(): Order {
    return this.validateStatus()
      .validatePaymentMethod()
      .validatePaymentStatus()
      .validatePrice()
      .validateCurrency()
      .validateItemCount()
      .validateDescription();
  }

  /**
   * Melempar bila stok tersedia tidak menutupi jumlah yang diminta.
   * Dipakai saat pemesanan, sebelum order di-instance.
   */
  static canSatisfyStock(available: number, requested: number): void {
    if (available < requested) {
      throw new Error(
        `Insufficient stock: available ${available}, requested ${requested}`,
      );
    }
  }
}

export { OrderStatus };
