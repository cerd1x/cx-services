import { AdminRepository } from "../ports/out/admin-repository.port";
import type { AdminUserView } from "../model/admin.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

/**
 * Daftar seluruh user untuk keperluan admin.
 *
 * Trust boundary ada di directive `@admin` pada field GraphQL — use case ini
 * sengaja tidak mengulang cek role supaya ada tepat satu sumber kebenaran.
 */
export class ListAdminUsersUseCase extends CoreUsecase<AdminUserView[]> {
  @logMethod(logger)
  async execute(): Promise<AdminUserView[]> {
    const adminRepo = this.deps.get(AdminRepository);
    return adminRepo.listUsers();
  }
}
