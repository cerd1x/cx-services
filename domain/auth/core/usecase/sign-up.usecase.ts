import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { AuthRepository } from "../ports/out/auth-repository.port";
import { Token } from "../value-objects/token.vo";
import type { User } from "../../../user/core/entity/user.entity";
import type { SettingService } from "$services/domain/setting";
import { SettingServiceCtx, UserServiceLikeCtx } from "./ctx";
import { AssetService } from "$services/domain/assets";
import { Balance } from "$services/domain/assets";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class SignUpUseCase extends CoreUsecase<
  { user: User; session: string; refreshToken: string },
  User
> {
  @logMethod(logger)
  async execute(user: User): Promise<{ user: User; session: string; refreshToken: string }> {
    const userService = this.deps.get(UserServiceLikeCtx);
    const authRepo = this.deps.get(AuthRepository);
    const settingService = this.deps.get(SettingServiceCtx) as unknown as SettingService;

    user = await userService.createUser(user.name, user.username, user.password);

    if (!user.id) throw new AuthenticationError("userId is required");

    try {
      await AssetService.getInstance().createAsset({
        userId: user.id!,
        balance: Balance.zero("IDR"),
        name: "MyCash",
        type: "cash",
      });

      await settingService.createDefaultSettings(user.id.toNumb);
    } catch (err) {
      const assetService = AssetService.getInstance();
      try {
        await assetService.deleteAsset("MyCash", user.id!);
      } catch {
        // ignore asset cleanup failure, continue with user deletion
      }
      await userService.deleteUser(user.id);
      throw err;
    }

    let token = Token.create({ userId: user.id.toNumb });

    const sessionExpiry = token.metadata.expiresAt;
    const refreshExpiry = new Date(Date.now() + Token.defaultExpireAt * 7);

    let resultToken = await authRepo.saveToken(user.id.toNumb, {
      sessionToken: token.setType("session").generate(),
      refreshToken: token
        .setType("refresh")
        .setExpireAt(Date.now() + Token.defaultExpireAt * 7)
        .generate(),
      expiredAtSession: sessionExpiry,
      expiredAtRefresh: refreshExpiry,
    });

    return {
      user,
      session: resultToken.session,
      refreshToken: resultToken.refreshToken,
    };
  }
}
