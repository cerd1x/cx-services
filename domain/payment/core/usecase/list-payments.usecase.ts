import { PaymentRepository } from "../ports/out/payment-repository.port";
import type { PaymentData } from "../../adapters/driven/drizzle/payment.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class ListPaymentsUseCase extends CoreUsecase<PaymentData[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<PaymentData[]> {
    const paymentRepo = this.deps.get(PaymentRepository);
    return paymentRepo.findAll(userId);
  }
}
