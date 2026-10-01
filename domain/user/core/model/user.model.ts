import { userSchema } from "../../adapters/driven/drizzle/user.entity";

export class UserRules {
  static validateName(name: string): void {
    const result = userSchema.shape.name.safeParse(name);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateUsername(username: string): void {
    const result = userSchema.shape.username.safeParse(username);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validatePassword(password: string): void {
    const result = userSchema.shape.password.safeParse(password);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }
}