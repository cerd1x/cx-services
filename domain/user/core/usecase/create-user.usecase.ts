import { ConflictError } from "$services/shared/kernel/errors/service-error";
import { UserRepository } from "../ports/out/user-repository.port";
import { User } from "../../adapters/driven/drizzle/user.entity";
import type { User as UserType } from "../../adapters/driven/drizzle/user.entity";
import { PasswordUtils } from "$services/shared/kernel/password-utils";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type CreateUserInput = {
  name: string;
  username: string;
  password: string;
  email?: string;
};

export class CreateUserUseCase extends CoreUsecase<UserType, CreateUserInput> {
  @logMethod(logger)
  async execute(input: CreateUserInput): Promise<UserType> {
    const userRepo = this.deps.get(UserRepository);
    const { name, username, password, email } = input;

    const taken = await userRepo.isWithUsername(username);
    if (taken) {
      throw new ConflictError(`User with username ${username} already exists`);
    }

    const hashed = await PasswordUtils.hash(password);
    let user = User.new({ name, username, email: email ?? "", password: hashed }).validateAll();
    user = await userRepo.save(user);

    if (!user.id) {
      throw new Error("Failed to create user: no id returned");
    }

    return user;
  }
}