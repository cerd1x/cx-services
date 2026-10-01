import { AuthRepository } from "../ports/out/auth-repository.port";
import { Token } from "../value-objects/token.vo";
import type { User } from "../../../user/core/model/user.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class IssueSessionUseCase extends CoreUsecase<
  { user: User; session: string; refreshToken: string },
  User
> {
  @logMethod(logger)
  async execute(user: User): Promise<{
    user: User;
    session: string;
    refreshToken: string;
  }> {
    const authRepo = this.deps.get(AuthRepository);

    const existing = await authRepo.findTokensByUserId(user.id!.toNumb);

    if (existing) {
      const refreshStillValid =
        existing.refreshToken && Date.now() < existing.expiredAtRefresh.getTime();

      if (refreshStillValid) {
        const sessionExpired = Date.now() >= existing.expiredAtSession.getTime();

        if (sessionExpired) {
          const t = Token.create({ userId: user.id!.toNumb });
          const newSession = t.setType("session").generate();

          await authRepo.updateToken(user.id!.toNumb, {
            session: newSession,
            expiredAtSession: new Date(Date.now() + Token.defaultExpireAt),
          });

          return {
            user,
            session: newSession,
            refreshToken: existing.refreshToken!,
          };
        }

        return {
          user,
          session: existing.session ?? existing.refreshToken!,
          refreshToken: existing.refreshToken!,
        };
      }
    }

    let token = Token.create({ userId: user.id!.toNumb });

    const newSession = token.setType("session").generate();
    const newRefresh = token
      .setType("refresh")
      .setExpireAt(Date.now() + Token.defaultExpireAt * 7)
      .generate();

    const sessionExpiry = new Date(Date.now() + Token.defaultExpireAt);
    const refreshExpiry = new Date(Date.now() + Token.defaultExpireAt * 7);

    if (existing) {
      await authRepo.updateToken(user.id!.toNumb, {
        session: newSession,
        refresh: newRefresh,
        expiredAtSession: sessionExpiry,
        expiredAtRefresh: refreshExpiry,
      });
    } else {
      await authRepo.saveToken(user.id!.toNumb, {
        sessionToken: newSession,
        refreshToken: newRefresh,
        expiredAtSession: sessionExpiry,
        expiredAtRefresh: refreshExpiry,
      });
    }

    return {
      user,
      session: newSession,
      refreshToken: newRefresh,
    };
  }
}
