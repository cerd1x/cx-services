import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

export const logger = streamLog(
  Logger.create(LogLevel.Info, ".logger/auth-service-log.log"),
).child("AuthService");