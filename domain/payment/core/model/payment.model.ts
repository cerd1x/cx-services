import { paymentSchema } from "../entity/payment.entity";

const VALID_TRANSITIONS = {
  pending: ["processing", "cancelled"],
  processing: ["completed", "failed"],
  completed: ["refunded"],
  failed: ["pending"],
  refunded: [],
  cancelled: [],
} as const;

type PaymentStatus = keyof typeof VALID_TRANSITIONS;

export class PaymentRules {
  static validateAmount(amount: number): void {
    const result = paymentSchema.shape.amount.safeParse(amount);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateCurrency(currency: string): void {
    const result = paymentSchema.shape.currency.safeParse(currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateMethod(method: string): void {
    const result = paymentSchema.shape.method.safeParse(method);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateStatus(status: string): void {
    const result = paymentSchema.shape.status.safeParse(status);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static canTransition(from: string, to: string): void {
    const allowed = VALID_TRANSITIONS[from as PaymentStatus] as readonly string[] | undefined;
    if (!allowed?.includes(to)) {
      throw new Error(`Invalid payment status transition: ${from} -> ${to}`);
    }
  }

  static canRetry(current: number, max: number): void {
    if (current >= max) {
      throw new Error(`Retry exhausted: current ${current}, max ${max}`);
    }
  }
}
