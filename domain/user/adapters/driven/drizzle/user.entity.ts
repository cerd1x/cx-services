import { RequiredErr } from "$services/shared/kernel/errors/service-error";
import { ID } from "$services/shared/kernel/id";
import { isMybe } from "$services/shared/kernel/is-mybe";
import { z } from "zod";

export const myUserID = z.instanceof(ID);

export const userSchema = z.object({
  id: myUserID.optional(),
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.email(),
  password: z.string().min(6, "Password must be at least 8 characters"),
  avatarUrl: z.string().nullable(),
});

export type UserType = z.infer<typeof userSchema>;

const nameSchema = userSchema.shape.name;
const usernameSchema = userSchema.shape.username;
const passwordSchema = userSchema.shape.password;

export class User {
  id?: ID;
  name!: string;
  username!: string;
  email!: string;
  password!: string;
  avatarUrl!: string | null;

  constructor(data: {
    name: string;
    username: string;
    email: string;
    password: string;
    avatarUrl?: string | null;
    id?: number;
  }) {
    this.name = data.name;
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.avatarUrl = data.avatarUrl ?? null;
    this.id = data.id ? ID.new(data.id) : undefined;
  }

  static new(data: {
    name: string;
    username: string;
    email: string;
    password: string;
    avatarUrl?: string | null;
  }): User {
    return new User(data);
  }

  get idHash(): string {
    if (isMybe(this.id)) throw new Error("required id for get idHash");
    return this.id?.toHash as string;
  }

  requiredId(): User {
    let result = myUserID.safeParse(this.id);

    if (!result.success) {
      throw new RequiredErr("id", { class: this });
    }
    return this;
  }

  validateName(): User {
    const result = nameSchema.safeParse(this.name);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateUsername(): User {
    const result = usernameSchema.safeParse(this.username);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validatePassword(): User {
    const result = passwordSchema.safeParse(this.password);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return this;
  }

  validateAll(): User {
    return this.validateName().validateUsername().validatePassword();
  }
}
