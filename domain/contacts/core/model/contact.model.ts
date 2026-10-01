import { contactSchema, MAX_PHONES, normalizePhones } from "../../adapters/driven/drizzle/contact.entity";

export class ContactRules {
  static validateName(name: string): void {
    const result = contactSchema.shape.name.safeParse(name);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validateEmail(email: string | undefined): void {
    if (email === undefined) return;
    const result = contactSchema.shape.email.safeParse(email);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static validatePhones(phones: string[] | undefined): void {
    if (phones === undefined) return;
    const result = contactSchema.shape.phones.safeParse(phones);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
  }

  static normalizePhones(input: string | string[] | undefined | null): string[] | undefined {
    return normalizePhones(input);
  }

  static canCombinePhones(total: number): void {
    if (total > MAX_PHONES) {
      throw new Error(`Cannot merge contacts: combined phone numbers exceed the limit of ${MAX_PHONES}`);
    }
  }
}