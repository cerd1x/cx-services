import { ApiKillswitchRepository } from "../ports/out/api-killswitch-repository.port";
import type { ApiKillswitch } from "../model/api-killswitch.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListDisabledOperationsUseCase extends CoreUsecase<ApiKillswitch[], void> {
  @logMethod(logger)
  async execute(): Promise<ApiKillswitch[]> {
    return this.deps.get(ApiKillswitchRepository).listDisabled();
  }
}