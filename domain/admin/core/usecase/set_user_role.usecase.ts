import { UserServiceCtx } from "./ctx";
import type { UserType } from "$services/domain/user";
import { ID } from "$services/shared/kernel/id";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type SetUserRoleInput = {
  userId: ID;
  role: string;
  /** Admin yang sedang bertindak — berasal dari `context.userAuth.id`. */
  actorId: ID;
};

/**
 * Mengubah peran user.
 *
 * `actorId` sengaja jadi parameter, bukan diambil dari container: container
 * dibuat sekali saat composition, sedangkan "siapa yang sedang bertindak"
 * berbeda tiap request. Resolveritemptykan dari `context.userAuth`.
 */
export class SetUserRoleUseCase extends CoreUsecase<UserType, SetUserRoleInput> {
  @logMethod(logger)
  async execute(input: SetUserRoleInput): Promise<UserType> {
    const userService = this.deps.get(UserServiceCtx);

    // Menolak demosi diri sendiri menutup jalan mengunci seluruh akun admin:
    // kalau hanya ada satu admin, demosi berarti tidak ada yang bisa membatalkan.
    if (input.actorId.decode === input.userId.decode) {
      throw new ValidationError("admin cannot change their own role");
    }

    return userService.updateUserRole(input.userId, input.role);
  }
}
