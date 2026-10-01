import { PaymentRepository } from "../ports/out/payment-repository.port";
import type { PaymentData } from "../entity/payment.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class ListPaymentsByStatusUseCase extends CoreUsecase<
  PaymentData[],
  { status: string; userId: ID }
> {
  @logMethod(logger)
  async execute(input: { status: string; userId: ID }): Promise<PaymentData[]> {
    const paymentRepo = this.deps.get(PaymentRepository);
    return paymentRepo.findByStatus(input.status, input.userId);
  }
}
