import { InvoiceRepository } from "../ports/out/invoice-repository.port";
import type { InvoiceData } from "../../adapters/driven/drizzle/invoice.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class ListInvoicesUseCase extends CoreUsecase<InvoiceData[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<InvoiceData[]> {
    const invoiceRepo = this.deps.get(InvoiceRepository);
    return invoiceRepo.findAll(userId);
  }
}
