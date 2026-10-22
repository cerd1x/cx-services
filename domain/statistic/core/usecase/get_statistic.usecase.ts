import type { StatisticData } from "../model/statistic.model";
import { StatisticRepository } from "../ports/out/statistic-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class GetStatisticUseCase extends CoreUsecase<StatisticData, number> {
  @logMethod(logger)
  async execute(userId: number): Promise<StatisticData> {
    const statisticRepo = this.deps.get(StatisticRepository);
    return statisticRepo.getStatistic(userId);
  }
}
