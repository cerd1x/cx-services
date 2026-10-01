import { Invoice, type InvoiceData, type InvoiceItem } from "../model/invoice.model";
import { InvoiceRepository } from "../ports/out/invoice-repository.port";
import { InvoiceValidationError } from "../errors/payment-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";
import { ID } from "$services/shared/kernel";

export type CreateInvoiceInput = {
  userId: number;
  customerId?: number;
  items: InvoiceItem[];
  currency: string;
  tax?: number;
  dueAt?: Date;
  description?: string;
};

export class CreateInvoiceUseCase extends CoreUsecase<InvoiceData, CreateInvoiceInput> {
  @logMethod(logger)
  async execute(input: CreateInvoiceInput): Promise<InvoiceData> {
    const invoiceRepo = this.deps.get(InvoiceRepository);

    const invoiceNumber = this.#generateInvoiceNumber();

    const invoice = Invoice.new({
      userId: input.userId,
      invoiceNumber,
      items: input.items,
      currency: input.currency,
      customerId: input.customerId,
      tax: input.tax,
      dueAt: input.dueAt,
      description: input.description,
    }).validateAll();

    const saved = await invoiceRepo.save(invoice.toData());
    if (!saved.id) {
      throw new InvoiceValidationError("Failed to save invoice");
    }
    return saved;
  }

  #generateInvoiceNumber(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `INV-${datePart}-${randomPart}`;
  }
}
