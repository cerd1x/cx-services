import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { UserServiceLikeCtx, PasskeyServiceCtx } from "./ctx";
import { ID } from "$services/shared/kernel";
import type { User } from "../../../user/core/entity/user.entity";
import type { PasskeyService } from "$services/domain/auth";
import { IssueSessionUseCase } from "./issue-session.usecase";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type SignInWithPassKeyInput = {
  challenge: string;
  credentialId: string;
  assertionResponse: AuthenticationResponseJSON;
  origin: string;
  rpID: string;
};

export class SignInWithPassKeyUseCase extends CoreUsecase<
  { user: User; session: string; refreshToken: string },
  SignInWithPassKeyInput
> {
  @logMethod(logger)
  async execute(input: SignInWithPassKeyInput): Promise<{
    user: User;
    session: string;
    refreshToken: string;
  }> {
    const userService = this.deps.get(UserServiceLikeCtx);
    const passkeyService = this.deps.get(PasskeyServiceCtx) as unknown as PasskeyService;

    const { userId } = await passkeyService.verifyAuthentication(input);

    const user = await userService.user(ID.new(userId));
    if (!user.id) throw new AuthenticationError("userId is required");

    return this.deps.get(IssueSessionUseCase).execute(user);
  }
}
