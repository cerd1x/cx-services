import { UserRepository } from "../ports/out/user-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class IsUsernameTakenUseCase extends CoreUsecase<boolean, string> {
  @logMethod(logger)
  async execute(username: string): Promise<boolean> {
    const userRepo = this.deps.get(UserRepository);
    return userRepo.isWithUsername(username);
  }
}