import { tokenSchema } from "../value-objects/token.vo";

export class TokenRules {
  static defaultExpireAt = 24 * 60 * 60 * 1000;

  static validateUserId(userId: number): void {
    const result = tokenSchema.shape.userId.safeParse(userId);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateType(type: string): void {
    const result = tokenSchema.shape.type.safeParse(type);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateExpiresAt(expiresAt: Date): void {
    if (expiresAt <= new Date()) {
      throw new Error("expiresAt must be in the future");
    }
  }

  static isExpired(expiresAt: Date): boolean {
    return Date.now() >= expiresAt.getTime();
  }
}