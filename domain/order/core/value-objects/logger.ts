import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

export const logger = streamLog(Logger.create(LogLevel.Info, ".logger/order-service-log.log")).child("OrderService");