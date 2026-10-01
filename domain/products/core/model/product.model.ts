import { productSchema } from "../entity/product.entity";

export class ProductRules {
  static validatePrice(price: number): void {
    const result = productSchema.shape.price.safeParse(price);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateCapital(capital: number | undefined): void {
    if (capital === undefined) return;
    const result = productSchema.shape.capital.safeParse(capital);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateStock(stock: number): void {
    const result = productSchema.shape.stock.safeParse(stock);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateCurrency(currency: string): void {
    const result = productSchema.shape.currency.safeParse(currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static margin(price: number, capital: number | undefined): number {
    return capital === undefined ? 0 : price - capital;
  }
}
