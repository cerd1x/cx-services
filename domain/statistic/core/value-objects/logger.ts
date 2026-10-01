import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

export const logger = streamLog(
  Logger.create(LogLevel.Info, ".logger/statistic-service-log.log"),
).child("StatisticService");