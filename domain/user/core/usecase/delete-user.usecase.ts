import { UserRepository } from "../ports/out/user-repository.port";
import { ID } from "$services/shared/kernel/id";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class DeleteUserUseCase extends CoreUsecase<boolean, ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<boolean> {
    const userRepo = this.deps.get(UserRepository);
    await userRepo.delete(userId.toNumb);
    return true;
  }
}