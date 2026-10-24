import { SettingRepository } from "../ports/out/setting-repository.port";
import { Setting, type SettingData } from "../model/setting.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type CreateDefaultSettingsInput = {
  userId: number;
  defaultAssetCashId?: number;
};

export class CreateDefaultSettingsUseCase extends CoreUsecase<
  SettingData,
  CreateDefaultSettingsInput
> {
  @logMethod(logger)
  async execute(input: CreateDefaultSettingsInput): Promise<SettingData> {
    const settingRepo = this.deps.get(SettingRepository);
    const setting = Setting.defaults(input.userId, input.defaultAssetCashId);
    return settingRepo.upsert(setting.metadata as SettingData);
  }
}
