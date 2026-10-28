import { UserRepository } from "../ports/out/user-repository.port";
import { userRoleSchema, type User as UserType, type UserRole } from "../model/user.model";
import { ID } from "$services/shared/kernel/id";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateUserRoleInput = {
  id: ID;
  role: string;
};

/**
 * Mengubah peran user. Satu-satunya jalur tulis ke kolom `role`.
 *
 * Sengaja tidak memakai `UserRepository.update()`: kolom role menentukan hak
 * akses, jadi harus lewat operasi eksplisit dan tidak ikut terbawa ketika
 * email/avatar diubah lewat jalur umum.
 */
export class UpdateUserRoleUseCase extends CoreUsecase<UserType, UpdateUserRoleInput> {
  @logMethod(logger)
  async execute(input: UpdateUserRoleInput): Promise<UserType> {
    const userRepo = this.deps.get(UserRepository);

    const parsed = userRoleSchema.safeParse(input.role);
    if (!parsed.success) {
      throw new ValidationError(`role must be one of: ${userRoleSchema.options.join(", ")}`, {
        cause: input.role,
      });
    }

    const role: UserRole = parsed.data;

    return userRepo.updateRole(input.id.decode, role);
  }
}
