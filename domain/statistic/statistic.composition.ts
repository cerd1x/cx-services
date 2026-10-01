import { type StatisticData } from "./adapters/driven/drizzle/statistic.entity";
import { GetStatisticUseCase } from "./core/usecase/get-statistic.usecase";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ServiceContainer } from "$services/shared/base";
import { StatisticRepositoryImpl } from "./adapters/driven/drizzle/statistic.repository";
import { StatisticRepository } from "./core/ports/out/statistic-repository.port";

export class StatisticService {
  static #instanceStatisticService: StatisticService;
  #getStatistic: GetStatisticUseCase;

  @logMethod(logger)
  static init(getStatistic: GetStatisticUseCase): StatisticService {
    StatisticService.#instanceStatisticService = new StatisticService(getStatistic);
    return StatisticService.#instanceStatisticService;
  }

  @logMethod(logger)
  static getInstance(): StatisticService {
    if (!StatisticService.#instanceStatisticService) {
      throw new Error("StatisticService not initialized");
    }
    return StatisticService.#instanceStatisticService;
  }

  private constructor(getStatistic: GetStatisticUseCase) {
    this.#getStatistic = getStatistic;
  }

  @logMethod(logger)
  async getStatistic(userId: number): Promise<StatisticData> {
    return this.#getStatistic.execute(userId);
  }
}

export type StatisticAdapters = {
  statisticRepo: StatisticRepository;
};

export function createStatisticService({ statisticRepo }: StatisticAdapters): StatisticService {
  const container = new ServiceContainer().set(StatisticRepository, statisticRepo);

  const getStatistic = new GetStatisticUseCase().setContext(container);

  return StatisticService.init(getStatistic);
}

logger.info("Initializing StatisticService...");
export const statisticService = createStatisticService({
  statisticRepo: new StatisticRepositoryImpl(),
});
logger.info("StatisticService initialized");
