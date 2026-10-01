import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

export const logger = streamLog(
  Logger.create(LogLevel.Info, ".logger/contact-service-log.log"),
).child("ContactService");