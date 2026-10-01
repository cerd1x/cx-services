import { SettingRepository } from "../ports/out/setting-repository.port";
import { Setting, type SettingData, type SettingInput } from "../entity/setting.entity";
import { SettingByUserIdUseCase } from "./setting-by-user-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateSettingInput = {
  userId: number;
  data: Partial<SettingInput>;
};

export class UpdateSettingUseCase extends CoreUsecase<SettingData, UpdateSettingInput> {
  @logMethod(logger)
  async execute(input: UpdateSettingInput): Promise<SettingData> {
    const settingRepo = this.deps.get(SettingRepository);
    const { userId, data } = input;

    const existing = await this.deps.get(SettingByUserIdUseCase).execute(userId);

    const setting = Setting.new({
      ...existing,
      ...data,
      userId,
    });

    return settingRepo.upsert(setting.metadata as SettingData);
  }
}
