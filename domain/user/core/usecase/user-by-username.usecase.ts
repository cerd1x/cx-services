import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { UserRepository } from "../ports/out/user-repository.port";
import type { User as UserType } from "../entity/user.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class UserByUsernameUseCase extends CoreUsecase<UserType, string> {
  @logMethod(logger)
  async execute(username: string): Promise<UserType> {
    const userRepo = this.deps.get(UserRepository);
    const user = await userRepo.findByUsername(username);
    if (!user) {
      throw new NotFoundError(`User with username ${username} not found`);
    }
    return user;
  }
}
