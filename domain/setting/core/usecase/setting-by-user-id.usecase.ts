import { SettingRepository } from "../ports/out/setting-repository.port";
import type { SettingData } from "../entity/setting.entity";
import { CreateDefaultSettingsUseCase } from "./create-default-settings.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class SettingByUserIdUseCase extends CoreUsecase<SettingData, number> {
  @logMethod(logger)
  async execute(userId: number): Promise<SettingData> {
    const settingRepo = this.deps.get(SettingRepository);
    const setting = await settingRepo.findByUserId(userId);
    if (!setting) {
      return this.deps.get(CreateDefaultSettingsUseCase).execute(userId);
    }
    return setting;
  }
}
