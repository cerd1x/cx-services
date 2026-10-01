import { ID } from "$services/shared/kernel";
import { z } from "zod";

export const productSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  name: z.string().min(1, "Name is required").max(200, "Name must be at most 200 characters"),
  description: z.string().max(1000, "Description must be at most 1000 characters").optional(),
  price: z.number().positive("Price must be positive"),
  capital: z.number().nonnegative("Capital must be non-negative").optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").toUpperCase(),
  stock: z.number().int().nonnegative("Stock must be non-negative"),
  trackStock: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ProductType = z.infer<typeof productSchema>;

const nameSchema = productSchema.shape.name;
const descriptionSchema = productSchema.shape.description;
const priceSchema = productSchema.shape.price;
const capitalSchema = productSchema.shape.capital;
const currencySchema = productSchema.shape.currency;
const stockSchema = productSchema.shape.stock;
const trackStockSchema = productSchema.shape.trackStock;

export class Product {
  id?: ID;
  userId?: number;
  name!: string;
  description?: string;
  price!: number;
  capital?: number;
  currency!: string;
  stock!: number;
  trackStock: boolean = true;
  createdAt?: Date;
  updatedAt?: Date;

  get margin(): number {
    if (this.capital === undefined) return 0;
    return this.price - this.capital;
  }

  constructor(data: {
    name: string;
    userId?: number;
    description?: string;
    price: number;
    capital?: number;
    currency: string;
    stock?: number;
    trackStock?: boolean;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.name = data.name;
    this.userId = data.userId;
    this.description = data.description;
    this.price = data.price;
    this.capital = data.capital;
    this.currency = data.currency;
    this.stock = data.stock ?? 0;
    this.trackStock = data.trackStock ?? true;
    this.id = data.id ? ID.new(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static new(data: {
    name: string;
    userId?: number;
    price: number;
    capital?: number;
    currency: string;
    description?: string;
    stock?: number;
    trackStock?: boolean;
  }): Product {
    return new Product(data);
  }

  validateName(): Product {
    const result = nameSchema.safeParse(this.name);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateDescription(): Product {
    if (this.description !== undefined) {
      const result = descriptionSchema.safeParse(this.description);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validatePrice(): Product {
    const result = priceSchema.safeParse(this.price);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateCapital(): Product {
    if (this.capital !== undefined) {
      const result = capitalSchema.safeParse(this.capital);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateCurrency(): Product {
    const result = currencySchema.safeParse(this.currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateStock(): Product {
    if (this.stock !== undefined) {
      const result = stockSchema.safeParse(this.stock);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateTrackStock(): Product {
    const result = trackStockSchema.safeParse(this.trackStock);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateAll(): Product {
    return this.validateName()
      .validateDescription()
      .validatePrice()
      .validateCapital()
      .validateCurrency()
      .validateStock()
      .validateTrackStock();
  }
}
