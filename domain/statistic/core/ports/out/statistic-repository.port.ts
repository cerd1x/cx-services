import type { StatisticData } from "../../../adapters/driven/drizzle/statistic.entity";

export abstract class StatisticRepository {
  abstract getStatistic(userId: number): Promise<StatisticData>;
}
