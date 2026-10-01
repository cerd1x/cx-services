import { InvoiceRepository } from "../ports/out/invoice-repository.port";
import type { InvoiceData } from "../entity/invoice.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class ListInvoicesByStatusUseCase extends CoreUsecase<
  InvoiceData[],
  { status: string; userId: ID }
> {
  @logMethod(logger)
  async execute(input: { status: string; userId: ID }): Promise<InvoiceData[]> {
    const invoiceRepo = this.deps.get(InvoiceRepository);
    return invoiceRepo.findByStatus(input.status, input.userId);
  }
}
