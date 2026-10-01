import { orderSchema } from "../../adapters/driven/drizzle/order.entity";

export class OrderRules {
  static validatePrice(price: number): void {
    const result = orderSchema.shape.price.safeParse(price);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateItemCount(itemCount: number): void {
    const result = orderSchema.shape.itemCount.safeParse(itemCount);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validatePaymentMethod(paymentMethod: string): void {
    const result = orderSchema.shape.paymentMethod.safeParse(paymentMethod);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static totalAmount(price: number, itemCount: number): number {
    return price * itemCount;
  }

  static canSatisfyStock(available: number, requested: number): void {
    if (available < requested) {
      throw new Error(`Insufficient stock: available ${available}, requested ${requested}`);
    }
  }
}