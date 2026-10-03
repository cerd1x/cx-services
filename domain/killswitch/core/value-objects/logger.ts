import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

export const logger = streamLog(Logger.create(LogLevel.Info, ".logger/killswitch.log")).child(
  "ApiKillswitch",
);