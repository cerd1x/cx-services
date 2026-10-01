import { transactionSchema } from "../../adapters/driven/drizzle/transaction.entity";

export class TransactionRules {
  static validateType(type: string): void {
    const result = transactionSchema.shape.type.safeParse(type);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateStatus(status: string): void {
    const result = transactionSchema.shape.status.safeParse(status);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateAmount(amount: number): void {
    const result = transactionSchema.shape.amount.safeParse(amount);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateCapital(capital: number): void {
    const result = transactionSchema.shape.capital.safeParse(capital);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }
}