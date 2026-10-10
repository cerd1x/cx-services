import type { User, UserRole } from "../../model/user.model";

export abstract class UserRepository {
  abstract isWithUsername(username: string): Promise<boolean>;
  abstract isWithUserId(userId: number): Promise<boolean>;
  abstract findByUsername(username: string): Promise<User | null>;
  abstract findById(id: number): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract save(user: User): Promise<User>;
  abstract update(user: User): Promise<User>;
  abstract delete(id: number): Promise<void>;
  /**
   * Jalur tulis terpisah untuk `role`.
   *
   * Sengaja tidak digabung ke `update()`/`save()`: kolom role menentukan hak
   * akses, jadi mengubahnya hanya boleh lewat operasi yang eksplisit
   * ({@see UpdateUserRoleUseCase}), bukan ikut terbawa ketika avatar atau email
   * diubah lewat jalur umum.
   */
  abstract updateRole(id: number, role: UserRole): Promise<User>;
}
