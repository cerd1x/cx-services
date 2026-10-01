import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { UserServiceLikeCtx, PasskeyServiceCtx } from "./ctx";
import { ID } from "$services/shared/kernel";
import type { PasskeyService } from "$services/domain/auth";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type PasskeyRegistrationOptionsInput = {
  userId: number;
  rpID: string;
  rpName: string;
};

export class PasskeyRegistrationOptionsUseCase extends CoreUsecase<
  Awaited<ReturnType<PasskeyService["generateRegistrationOptions"]>>,
  PasskeyRegistrationOptionsInput
> {
  @logMethod(logger)
  async execute(input: PasskeyRegistrationOptionsInput) {
    const userService = this.deps.get(UserServiceLikeCtx);
    const passkeyService = this.deps.get(PasskeyServiceCtx) as unknown as PasskeyService;

    const user = await userService.user(ID.new(input.userId));
    if (!user.id) throw new AuthenticationError("userId is required");
    return passkeyService.generateRegistrationOptions({
      user,
      rpID: input.rpID,
      rpName: input.rpName,
    });
  }
}