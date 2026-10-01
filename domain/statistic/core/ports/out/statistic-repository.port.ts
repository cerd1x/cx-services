import type { StatisticData } from "../../entity/statistic.entity";

export abstract class StatisticRepository {
  abstract getStatistic(userId: number): Promise<StatisticData>;
}
