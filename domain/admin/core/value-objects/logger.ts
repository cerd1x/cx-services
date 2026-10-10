import { streamLog, Logger, LogLevel } from "$services/shared/infra/logger";

export const logger = streamLog(
  Logger.create(LogLevel.Info, ".logger/admin-service-log.log"),
).child("AdminService");
