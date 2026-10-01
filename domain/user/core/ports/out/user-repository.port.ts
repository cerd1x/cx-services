import type { User } from "../../../adapters/driven/drizzle/user.entity";

export abstract class UserRepository {
  abstract isWithUsername(username: string): Promise<boolean>;
  abstract isWithUserId(userId: number): Promise<boolean>;
  abstract findByUsername(username: string): Promise<User | null>;
  abstract findById(id: number): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract save(user: User): Promise<User>;
  abstract update(user: User): Promise<User>;
  abstract delete(id: number): Promise<void>;
}
