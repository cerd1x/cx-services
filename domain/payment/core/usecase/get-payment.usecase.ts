import { PaymentRepository } from "../ports/out/payment-repository.port";
import type { PaymentData } from "../entity/payment.entity";
import { PaymentValidationError } from "../errors/payment-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class GetPaymentUseCase extends CoreUsecase<PaymentData, { id: ID; userId: ID }> {
  @logMethod(logger)
  async execute(input: { id: ID; userId: ID }): Promise<PaymentData> {
    const paymentRepo = this.deps.get(PaymentRepository);
    const payment = await paymentRepo.findById(input.id.toNumb, input.userId);
    if (!payment) {
      throw new PaymentValidationError(`Payment ${input.id.toNumb} not found`);
    }
    return payment;
  }
}
