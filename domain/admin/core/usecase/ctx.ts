import type { ID } from "$services/shared/kernel";
import type { UserType } from "$services/domain/user";

/**
 * Token DI untuk `UserService`.
 *
 * Sengaja memakai kelas stub, bukan import langsung `userService`, supaya
 *_admin_ yang diekspor barrel, dan dependensi bisa diganti saat test.
 * diekspor barrel, dan dependensi bisa diganti saat test.
 *
 * Hanya dua operasi yang dibutuhkan modul admin, jadi tokennya sekecil itu —
 * admin tidak boleh bisa butuh operasi user lain tanpa sengaja menambahkannya
 * ke sini.
 */
export class UserServiceCtx {
  updateUserRole(_id: ID, _role: string): Promise<UserType> {
    throw new Error("Method not implemented.");
  }
  deleteUser(_userId: ID): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
