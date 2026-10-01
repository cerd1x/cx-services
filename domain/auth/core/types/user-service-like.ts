import type { User } from "../../../user/core/entity/user.entity";
import { ID } from "$services/shared/kernel";

export interface UserServiceLike {
  createUser(name: string, username: string, password: string): Promise<User>;
  userByUsername(username: string): Promise<User>;
  user(id: ID): Promise<User>;
  deleteUser(userId: ID): Promise<boolean>;
}
