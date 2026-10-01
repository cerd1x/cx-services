import { SettingRepository } from "../ports/out/setting-repository.port";
import { Setting, type SettingData } from "../entity/setting.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class CreateDefaultSettingsUseCase extends CoreUsecase<SettingData, number> {
  @logMethod(logger)
  async execute(userId: number): Promise<SettingData> {
    const settingRepo = this.deps.get(SettingRepository);
    const setting = Setting.defaults(userId);
    return settingRepo.upsert(setting.metadata as SettingData);
  }
}
