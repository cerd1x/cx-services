import { UserRepository } from "../ports/out/user-repository.port";
import type { User as UserType } from "../entity/user.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListUsersUseCase extends CoreUsecase<UserType[], void> {
  @logMethod(logger)
  async execute(): Promise<UserType[]> {
    const userRepo = this.deps.get(UserRepository);
    return userRepo.findAll();
  }
}
