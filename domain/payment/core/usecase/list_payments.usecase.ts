import { PaymentRepository } from "../ports/out/payment-repository.port";
import { Payment } from "../model/payment.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class ListPaymentsUseCase extends CoreUsecase<Payment[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<Payment[]> {
    const paymentRepo = this.deps.get(PaymentRepository);
    return paymentRepo.findAll(userId);
  }
}
