import { AdminRepository } from "../ports/out/admin-repository.port";
import type { AdminOverview } from "../model/admin.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class GetAdminOverviewUseCase extends CoreUsecase<AdminOverview> {
  @logMethod(logger)
  async execute(): Promise<AdminOverview> {
    const adminRepo = this.deps.get(AdminRepository);
    return adminRepo.getOverview();
  }
}
