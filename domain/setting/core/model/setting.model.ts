import { settingSchema } from "../entity/setting.entity";

export class SettingRules {
  static validateCurrency(currency: string): void {
    const result = settingSchema.shape.currency.safeParse(currency);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateDateFormat(dateFormat: string): void {
    const result = settingSchema.shape.dateFormat.safeParse(dateFormat);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }
}
