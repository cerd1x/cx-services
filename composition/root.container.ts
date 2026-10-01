import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

const logger = streamLog(Logger.create(LogLevel.Info, ".logger/services.log")).child("Services");
logger.info("Initializing services...");

import "$services/domain/user";
import "$services/domain/assets";
import "$services/domain/contacts";
import "$services/domain/products";
import "$services/domain/transactions";
import "$services/domain/setting";
import "$services/domain/auth";
import "$services/domain/statistic";
import "$services/domain/order";
import "$services/domain/payment";

logger.info("All services initialized");

export { userService } from "$services/domain/user";
export { assetService } from "$services/domain/assets";
export { contactService } from "$services/domain/contacts";
export { transactionService } from "$services/domain/transactions";
export { productService } from "$services/domain/products";
export { authService } from "$services/domain/auth";
export { settingService } from "$services/domain/setting";
export { statisticService } from "$services/domain/statistic";
export { orderService } from "$services/domain/order";
export { paymentService } from "$services/domain/payment";
