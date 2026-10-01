import { InvoiceRepository } from "../ports/out/invoice-repository.port";
import { Invoice, type InvoiceData } from "../entity/invoice.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export class IssueInvoiceUseCase extends CoreUsecase<InvoiceData, { id: ID; userId: ID }> {
  @logMethod(logger)
  async execute(input: { id: ID; userId: ID }): Promise<InvoiceData> {
    const invoiceRepo = this.deps.get(InvoiceRepository);

    const existing = await invoiceRepo.findById(input.id.toNumb, input.userId);
    if (!existing) {
      throw new Error(`Invoice with id ${input.id.toNumb} not found`);
    }

    const invoice = Invoice.new({
      userId: existing.userId,
      invoiceNumber: existing.invoiceNumber,
      items: existing.items,
      currency: existing.currency,
      customerId: existing.customerId,
      tax: existing.tax,
      status: existing.status,
      description: existing.description,
    });

    invoice.markAsIssued();

    return invoiceRepo.update(input.id.toNumb, { status: invoice.status }, input.userId);
  }
}
