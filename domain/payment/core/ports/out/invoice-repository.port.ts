import type { ID } from "$services/shared/kernel";
import type { InvoiceData, InvoiceUpdateData } from "../../entity/invoice.entity";

export abstract class InvoiceRepository {
  abstract save(invoice: InvoiceData): Promise<InvoiceData>;
  abstract findById(id: number, userId: ID): Promise<InvoiceData | null>;
  abstract findByInvoiceNumber(invoiceNumber: string, userId: ID): Promise<InvoiceData | null>;
  abstract findAll(userId: ID): Promise<InvoiceData[]>;
  abstract findByStatus(status: string, userId: ID): Promise<InvoiceData[]>;
  abstract update(id: number, data: InvoiceUpdateData, userId: ID): Promise<InvoiceData>;
  abstract delete(id: number, userId: ID): Promise<void>;
}
