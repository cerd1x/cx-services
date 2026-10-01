import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { UserServiceLikeCtx } from "./ctx";
import { PasswordUtils } from "$services/shared/kernel/password-utils";
import type { User } from "../../../user/adapters/driven/drizzle/user.entity";
import { IssueSessionUseCase } from "./issue-session.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type SignInInput = {
  username: string;
  password: string;
};

export class SignInUseCase extends CoreUsecase<
  { user: User; session: string; refreshToken: string },
  SignInInput
> {
  @logMethod(logger)
  async execute(input: SignInInput): Promise<{
    user: User;
    session: string;
    refreshToken: string;
  }> {
    const userService = this.deps.get(UserServiceLikeCtx);
    const { username, password } = input;

    const log = logger.child("signIn");

    log.child("params").info({ username });

    const user = await userService.userByUsername(username);

    if (!(await PasswordUtils.verify(password, user.password))) {
      log.child("validate").error("fail -> invalid password");
      throw new AuthenticationError("Invalid password");
    }

    log
      .child("validate")
      .success("success", { id: user.id?.toNumb, name: user.name });

    if (!user.id) throw new AuthenticationError("userId is required");

    const result = await this.deps.get(IssueSessionUseCase).execute(user);

    log.child("result").success({
      user: { id: result.user.id?.toNumb, name: result.user.name },
      session: result.session,
      refreshToken: result.refreshToken,
    });

    return result;
  }
}