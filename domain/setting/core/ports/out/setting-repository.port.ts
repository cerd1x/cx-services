import type { SettingData } from "../../entity/setting.entity";

export abstract class SettingRepository {
  abstract findByUserId(userId: number): Promise<SettingData | null>;
  abstract upsert(setting: SettingData): Promise<SettingData>;
}
