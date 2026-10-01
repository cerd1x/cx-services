import { ID } from "$services/shared/kernel";
import { z } from "zod";

export const MAX_PHONES = 10;

const phoneSchema = z
  .string()
  .min(8, "Phone must be at least 8 characters")
  .max(20, "Phone must be at most 20 characters");

const phonesSchema = z
  .array(phoneSchema)
  .max(MAX_PHONES, `A contact can hold at most ${MAX_PHONES} phone numbers`);

export const contactSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  name: z.string().min(1, "Name is required").max(200, "Name must be at most 200 characters"),
  email: z.email("Invalid email format").optional(),
  phone: phoneSchema.optional(),
  phones: phonesSchema.optional(),
  group: z.string().max(50, "Group must be at most 50 characters").optional(),
  avatar: z.url("Avatar must be a valid URL").optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ContactType = z.infer<typeof contactSchema>;

// Normalize arbitrary phone input into a deduplicated array (max MAX_PHONES).
export function normalizePhones(input: string | string[] | undefined | null): string[] | undefined {
  if (input === undefined || input === null) return undefined;
  const list = Array.isArray(input) ? input : [input];
  const cleaned = list.map((p) => p?.trim() ?? "").filter((p) => p.length > 0);
  const unique = [...new Set(cleaned)];
  return unique.length > 0 ? unique.slice(0, MAX_PHONES) : undefined;
}

// Individual field schemas derived from main schema for class validation
const nameSchema = contactSchema.shape.name;
const emailSchema = contactSchema.shape.email;
const groupSchema = contactSchema.shape.group;
const avatarSchema = contactSchema.shape.avatar;

export class Contact {
  id?: ID;
  userId: ID;
  name: string;
  email?: string;
  phones?: string[];
  group?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    name: string;
    userId: ID;
    email?: string;
    phone?: string | string[];
    phones?: string | string[];
    group?: string;
    avatar?: string;
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.name = data.name;
    this.userId = data.userId;
    this.email = data.email;
    this.phones = normalizePhones(data.phones ?? data.phone);
    this.group = data.group;
    this.avatar = data.avatar;
    this.id = data.id ? ID.new(data.id) : undefined;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static new(data: {
    name: string;
    userId: ID;
    email?: string;
    phone?: string | string[];
    phones?: string | string[];
    group?: string;
    avatar?: string;
  }): Contact {
    return new Contact(data);
  }

  set setId(id: number) {
    this.id = ID.new(id);
  }

  // Compatibility accessor: first/primary phone number.
  get phone(): string | undefined {
    return this.phones?.[0];
  }

  // Sets the primary (first) phone number while keeping the rest of the list.
  set phone(value: string | undefined) {
    if (value === undefined) return;
    const current = this.phones ?? [];
    const rest = current.filter((p) => p !== value);
    this.phones = normalizePhones([value, ...rest]);
  }

  validateName(): Contact {
    const result = nameSchema.safeParse(this.name);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateEmail(): Contact {
    if (this.email !== undefined) {
      const result = emailSchema.safeParse(this.email);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validatePhone(): Contact {
    if (this.phone !== undefined) {
      const result = phoneSchema.safeParse(this.phone);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validatePhones(): Contact {
    if (this.phones !== undefined) {
      const result = phonesSchema.safeParse(this.phones);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateGroup(): Contact {
    if (this.group !== undefined) {
      const result = groupSchema.safeParse(this.group);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateAvatar(): Contact {
    if (this.avatar !== undefined) {
      const result = avatarSchema.safeParse(this.avatar);
      if (!result.success) {
        throw new Error(result.error.issues.map((i) => i.message).join(", "));
      }
    }
    return this;
  }

  validateAll(): Contact {
    return this.validateName()
      .validateEmail()
      .validatePhone()
      .validatePhones()
      .validateGroup()
      .validateAvatar();
  }
}
