import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { UserRepository } from "../ports/out/user-repository.port";
import type { User as UserType } from "../model/user.model";
import { ID } from "$services/shared/kernel/id";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class UserByIdUseCase extends CoreUsecase<UserType, ID> {
  @logMethod(logger)
  async execute(id: ID): Promise<UserType> {
    const userRepo = this.deps.get(UserRepository);
    const user = await userRepo.findById(id.toNumb);
    if (!user) {
      throw new NotFoundError(`User with id ${id.toNumb}`);
    }
    return user;
  }
}
