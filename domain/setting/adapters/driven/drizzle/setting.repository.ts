import { eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { settingTable } from "$services/shared/infra/db/drizzle-schema";
import { SettingRepository } from "../../../core/ports/out/setting-repository.port";
import type { SettingData } from "../../../core/model/setting.model";

export class SettingRepositoryImpl implements SettingRepository {
  async findByUserId(userId: number): Promise<SettingData | null> {
    const result = await getDB()
      .select()
      .from(settingTable)
      .where(eq(settingTable.userId, userId))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      userId: row.userId,
      currency: row.currency,
      darkMode: row.darkMode,
      dateFormat: row.dateFormat,
    };
  }

  async upsert(setting: SettingData): Promise<SettingData> {
    const existing = await this.findByUserId(setting.userId);

    if (existing) {
      const result = await getDB()
        .update(settingTable)
        .set({
          currency: setting.currency,
          darkMode: setting.darkMode,
          dateFormat: setting.dateFormat,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(settingTable.userId, setting.userId))
        .returning();

      const row = result[0];
      return {
        id: row.id,
        userId: row.userId,
        currency: row.currency,
        darkMode: row.darkMode,
        dateFormat: row.dateFormat,
      };
    }

    const result = await getDB()
      .insert(settingTable)
      .values({
        userId: setting.userId,
        currency: setting.currency,
        darkMode: setting.darkMode,
        dateFormat: setting.dateFormat,
      })
      .returning();

    const row = result[0];
    return {
      id: row.id,
      userId: row.userId,
      currency: row.currency,
      darkMode: row.darkMode,
      dateFormat: row.dateFormat,
    };
  }
}
