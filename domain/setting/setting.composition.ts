import { type SettingData, type SettingInput } from "./adapters/driven/drizzle/setting.entity";
import { CreateDefaultSettingsUseCase } from "./core/usecase/create-default-settings.usecase";
import { SettingByUserIdUseCase } from "./core/usecase/setting-by-user-id.usecase";
import { UpdateSettingUseCase } from "./core/usecase/update-setting.usecase";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ServiceContainer } from "$services/shared/base";
import { SettingRepositoryImpl } from "./adapters/driven/drizzle/setting.repository";
import { SettingRepository } from "./core/ports/out/setting-repository.port";

export class SettingService {
  static #instanceSettingService: SettingService;
  #createDefaultSettings: CreateDefaultSettingsUseCase;
  #settingByUserId: SettingByUserIdUseCase;
  #updateSetting: UpdateSettingUseCase;

  @logMethod(logger)
  static init(
    createDefaultSettings: CreateDefaultSettingsUseCase,
    settingByUserId: SettingByUserIdUseCase,
    updateSetting: UpdateSettingUseCase,
  ): SettingService {
    SettingService.#instanceSettingService = new SettingService(
      createDefaultSettings,
      settingByUserId,
      updateSetting,
    );
    return SettingService.#instanceSettingService;
  }

  @logMethod(logger)
  static getInstance(): SettingService {
    if (!SettingService.#instanceSettingService) {
      throw new Error("SettingService not initialized");
    }
    return SettingService.#instanceSettingService;
  }

  private constructor(
    createDefaultSettings: CreateDefaultSettingsUseCase,
    settingByUserId: SettingByUserIdUseCase,
    updateSetting: UpdateSettingUseCase,
  ) {
    this.#createDefaultSettings = createDefaultSettings;
    this.#settingByUserId = settingByUserId;
    this.#updateSetting = updateSetting;
  }

  @logMethod(logger)
  async createDefaultSettings(userId: number): Promise<SettingData> {
    return this.#createDefaultSettings.execute(userId);
  }

  @logMethod(logger)
  async settingByUserId(userId: number): Promise<SettingData> {
    return this.#settingByUserId.execute(userId);
  }

  @logMethod(logger)
  async updateSetting(userId: number, data: Partial<SettingInput>): Promise<SettingData> {
    return this.#updateSetting.execute({ userId, data });
  }
}

export type SettingAdapters = {
  settingRepo: SettingRepository;
};

export function createSettingService({ settingRepo }: SettingAdapters): SettingService {
  const container = new ServiceContainer().set(SettingRepository, settingRepo);

  const createDefaultSettings = new CreateDefaultSettingsUseCase().setContext(container);
  const settingByUserId = new SettingByUserIdUseCase().setContext(container);
  const updateSetting = new UpdateSettingUseCase().setContext(container);

  container.set(CreateDefaultSettingsUseCase, createDefaultSettings);
  container.set(SettingByUserIdUseCase, settingByUserId);

  return SettingService.init(createDefaultSettings, settingByUserId, updateSetting);
}

logger.info("Initializing SettingService...");
export const settingService = createSettingService({ settingRepo: new SettingRepositoryImpl() });
logger.info("SettingService initialized");
