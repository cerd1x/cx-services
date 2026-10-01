import { eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema";
import { User } from "../../../core/entity/user.entity";
import { UserRepository } from "../../../core/ports/out/user-repository.port";

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
    });
  }

  async delete(id: number): Promise<void> {
    await getDB().delete(userTable).where(eq(userTable.id, id));
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
    });
  }
}
