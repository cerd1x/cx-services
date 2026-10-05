import {
  AuthenticationError,
  UnauthorizedError,
} from "$services/shared/kernel/errors/service-error";
import { AuthRepository } from "../ports/out/auth-repository.port";
import { Token } from "../value-objects/token.vo";
import type { User } from "../../../user/core/model/user.model";
import { UserServiceLikeCtx } from "./ctx";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class AuthorizeUseCase extends CoreUsecase<
  {
    user: User;
    token: { session: string | null; refresh: string | null } | null;
  },
  string
> {
  @logMethod(logger)
  async execute(token: string): Promise<{
    user: User;
    token: { session: string | null; refresh: string | null } | null;
  }> {
    const userService = this.deps.get(UserServiceLikeCtx);
    const authRepo = this.deps.get(AuthRepository);

    if (token.length === 0) throw new AuthenticationError("Token is required");

    try {
      const data = await authRepo.findToken(token);
      if (!data) {
        throw new AuthenticationError("Invalid token");
      }

      if (Date.now() >= data.expiredAtSession.getTime()) {
        if (!data.refreshToken) {
          throw new UnauthorizedError("token expired, please sign-in again");
        }

        const refreshTokenObj = await Token.from(data.refreshToken);
        if (refreshTokenObj.isExpired()) {
          throw new UnauthorizedError("token expired, please sign-in again");
        }

        const t = await Token.from(token);
        t.setExpireAt(Date.now() + Token.defaultExpireAt);
        const sst = await t.setType("session").generate();

        const user = await userService.user(ID.new(t.userId));
        if (!user.id) throw new AuthenticationError("userId is required");

        await authRepo.updateToken(t.userId, {
          session: sst,
          expiredAtSession: new Date(Date.now() + Token.defaultExpireAt),
        });

        return {
          user,
          token: {
            session: sst,
            refresh: null,
          },
        };
      }

      const user = await userService.user(ID.new(data.userId));
      if (!user.id) throw new AuthenticationError("userId is required");

      return {
        user,
        token: null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError("Token Invalid");
    }
  }
}
