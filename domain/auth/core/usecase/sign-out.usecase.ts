import { AuthRepository } from "../ports/out/auth-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type SignOutInput = {
  sessionToken: string;
  refreshToken?: string;
};

export class SignOutUseCase extends CoreUsecase<void, SignOutInput> {
  @logMethod(logger)
  async execute(input: SignOutInput): Promise<void> {
    const authRepo = this.deps.get(AuthRepository);
    const { sessionToken, refreshToken } = input;

    await authRepo.deleteToken(sessionToken);
    if (refreshToken) {
      await authRepo.deleteToken(refreshToken);
    }
  }
}