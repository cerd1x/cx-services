import type { StatisticData } from "../../model/statistic.model";

export abstract class StatisticRepository {
  abstract getStatistic(userId: number): Promise<StatisticData>;
}
