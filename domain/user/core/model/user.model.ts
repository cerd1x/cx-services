import { RequiredErr } from "$services/shared/kernel/errors/service-error";
import { ID } from "$services/shared/kernel/id";
import { isMybe } from "$services/shared/kernel/is-mybe";
import { z } from "zod";

export const myUserID = z.instanceof(ID);

/**
 * Peran user untuk RBAC. Diturunkan dari kolom `user.role`.
 *
 * Sengaja `z.enum` dan bukan enum Drizzle supaya peran baru bisa ditambah
 * tanpa `ALTER TABLE` — tabel `user` sudah berisi data production.
 */
export const userRoleSchema = z.enum(["user", "admin"]);

export type UserRole = z.infer<typeof userRoleSchema>;

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
  role: userRoleSchema.default("user"),
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
  role!: UserRole;

  constructor(data: {
    name: string;
    username: string;
    email: string;
    password: string;
    avatarUrl?: string | null;
    role?: UserRole;
    id?: number;
  }) {
    this.name = data.name;
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.avatarUrl = data.avatarUrl ?? null;
    this.role = data.role ?? "user";
    this.id = data.id ? ID.new(data.id) : undefined;
  }

  static new(data: {
    name: string;
    username: string;
    email: string;
    password: string;
    avatarUrl?: string | null;
    role?: UserRole;
  }): User {
    return new User(data);
  }

  /** true bila user punya hak akses admin. */
  get isAdmin(): boolean {
    return this.role === "admin";
  }

  get idHash(): string {
    if (isMybe(this.id)) throw new Error("required id for get idHash");
    return this.id?.str as string;
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
