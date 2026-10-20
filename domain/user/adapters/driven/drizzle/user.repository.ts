import { eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema";
import { NotFound } from "$services/shared/kernel/errors/service-error";
import { User } from "../../../core/model/user.model";
import { UserRepository } from "../../../core/ports/out/user-repository.port";
import type { UserRole } from "../../../core/model/user.model";

export class UserRepositoryImpl implements UserRepository {
  async isWithUsername(username: string): Promise<boolean> {
    const result = await getDB()
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, username))
      .limit(1);

    return result.length > 0;
  }

  async isWithUserId(userId: number): Promise<boolean> {
    const result = await getDB()
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    return result.length > 0;
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await getDB()
      .select()
      .from(userTable)
      .where(eq(userTable.username, username))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return new User({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      password: row.password,
      avatarUrl: row.avatar,
      role: row.role,
    });
  }

  async findAll(): Promise<User[]> {
    const result = await getDB().select().from(userTable);
    return result.map(
      (row) =>
        new User({
          id: row.id,
          name: row.name,
          username: row.username,
          email: row.email,
          password: row.password,
          avatarUrl: row.avatar,
          role: row.role,
        }),
    );
  }

  async findById(id: number): Promise<User | null> {
    const result = await getDB().select().from(userTable).where(eq(userTable.id, id)).limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return new User({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      password: row.password,
      avatarUrl: row.avatar,
      role: row.role,
    });
  }

  async update(user: User): Promise<User> {
    const result = await getDB()
      .update(userTable)
      .set({
        name: user.name,
        username: user.username,
        email: user.email,
        password: user.password,
        avatar: user.avatarUrl,
      })
      .where(eq(userTable.id, user.id!.toNumb))
      .returning();

    const row = result[0];
    return new User({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      password: row.password,
      avatarUrl: row.avatar,
      role: row.role,
    });
  }

  async delete(id: number): Promise<void> {
    await getDB().delete(userTable).where(eq(userTable.id, id));
  }

  /**
   * `update()` di atas sengaja tidak menyentuh kolom `role` — lihat catatan di
   * `UserRepository.updateRole`.
   */
  async updateRole(id: number, role: UserRole): Promise<User> {
    const result = await getDB()
      .update(userTable)
      .set({ role })
      .where(eq(userTable.id, id))
      .returning();

    const row = result[0];
    if (!row) {
      throw new NotFound(`user #${id}`, { exact: true });
    }

    return new User({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      password: row.password,
      avatarUrl: row.avatar,
      role: row.role,
    });
  }

  async save(user: User): Promise<User> {
    const result = await getDB()
      .insert(userTable)
      .values({
        name: user.name,
        username: user.username,
        email: user.email,
        password: user.password,
        avatar: user.avatarUrl,
      })
      .returning();

    const row = result[0];
    return new User({
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      password: row.password,
      avatarUrl: row.avatar,
      role: row.role,
    });
  }
}
