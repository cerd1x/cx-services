import type { SettingData } from "../../../adapters/driven/drizzle/setting.entity";

export abstract class SettingRepository {
  abstract findByUserId(userId: number): Promise<SettingData | null>;
  abstract upsert(setting: SettingData): Promise<SettingData>;
}
