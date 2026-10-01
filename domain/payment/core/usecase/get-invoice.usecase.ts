import { InvoiceRepository } from "../ports/out/invoice-repository.port";
import type { InvoiceData } from "../entity/invoice.entity";
import { InvoiceValidationError } from "../errors/payment-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class GetInvoiceUseCase extends CoreUsecase<InvoiceData, { id: ID; userId: ID }> {
  @logMethod(logger)
  async execute(input: { id: ID; userId: ID }): Promise<InvoiceData> {
    const invoiceRepo = this.deps.get(InvoiceRepository);
    const invoice = await invoiceRepo.findById(input.id.toNumb, input.userId);
    if (!invoice) {
      throw new InvoiceValidationError(`Invoice with id ${input.id.toNumb} not found`);
    }
    return invoice;
  }
}
