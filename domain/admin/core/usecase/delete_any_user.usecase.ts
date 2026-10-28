import { UserServiceCtx } from "./ctx";
import { ID } from "$services/shared/kernel/id";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeleteAnyUserInput = {
  userId: ID;
  /** Admin yang sedang bertindak — berasal dari `context.userAuth.id`. */
  actorId: ID;
};

/**
 * Menghapus user mana pun, bukan hanya milik sendiri seperti `deleteUser`.
 *
 * Menolak hapus diri sendiri mencegah admin terakhir mengunci dirinya keluar
 * dari sistem saat user lain belum siap mengambil alih peran `admin`.
 */
export class DeleteAnyUserUseCase extends CoreUsecase<boolean, DeleteAnyUserInput> {
  @logMethod(logger)
  async execute(input: DeleteAnyUserInput): Promise<boolean> {
    const userService = this.deps.get(UserServiceCtx);

    if (input.actorId.decode === input.userId.decode) {
      throw new ValidationError("admin cannot delete their own account");
    }

    return userService.deleteUser(input.userId);
  }
}
