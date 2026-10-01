import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

export const logger = streamLog(
  Logger.create(LogLevel.Info, ".logger/transaction-service-log.log"),
).child("TransactionService");