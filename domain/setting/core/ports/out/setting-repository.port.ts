import type { SettingData } from "../../model/setting.model";

export abstract class SettingRepository {
  abstract findByUserId(userId: number): Promise<SettingData | null>;
  abstract upsert(setting: SettingData): Promise<SettingData>;
}
