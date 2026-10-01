import { ID } from "$services/shared/kernel";
import { z } from "zod";

const OrderStatus = {
  pending: "pending",
  success: "success",
  cancelled: "cancelled",
} as const;

type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const orderSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  status: z.enum(["pending", "success", "cancelled"]).default("pending"),
  paymentMethod: z
    .enum(["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"])
    .default("cash"),
  price: z.number().positive("Price must be positive"),
  totalAmount: z.number().optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").toUpperCase(),
  itemCount: z.number().int().positive("Item count must be positive"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  customerId: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type OrderType = z.infer<typeof orderSchema>;

const statusSchema = orderSchema.shape.status;
const paymentMethodSchema = orderSchema.shape.paymentMethod;
const priceSchema = orderSchema.shape.price;
const totalAmountSchema = orderSchema.shape.totalAmount;
const currencySchema = orderSchema.shape.currency;
const itemCountSchema = orderSchema.shape.itemCount;
const descriptionSchema = orderSchema.shape.description;

export class Order {
  id?: ID;
  userId?: number;
  status: OrderStatus = "pending";
  paymentMethod: string = "cash";
  price!: number;
  totalAmount!: number;
  currency!: string;
  itemCount!: number;
  description?: string;
  customerId?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    price: number;
    currency: string;
    itemCount: number;
    userId?: number;
    status?: OrderStatus;
    paymentMethod?: string;
    description?: string;
    customerId?: number;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.price = data.price;
    this.totalAmount = data.price * data.itemCount;
    this.currency = data.currency;
    this.itemCount = data.itemCount;
    this.userId = data.userId;
    if (data.status) this.status = data.status;
    if (data.paymentMethod) this.paymentMethod = data.paymentMethod;
    this.description = data.description;
    this.customerId = data.customerId;
    this.id = data.id ? ID.new(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static new(data: {
    price: number;
    currency: string;
    itemCount: number;
    userId?: number;
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

  getTotalAmount(): number {
    return this.price * this.itemCount;
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

  validateAll(): Order {
    return this.validateStatus()
      .validatePaymentMethod()
      .validatePrice()
      .validateCurrency()
      .validateItemCount()
      .validateDescription();
  }
}

export { OrderStatus };
