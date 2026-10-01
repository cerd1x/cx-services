import type { ID } from "$services/shared/kernel";
import type { PaymentData, PaymentUpdateData } from "../../model/payment.model";

export abstract class PaymentRepository {
  abstract save(payment: PaymentData): Promise<PaymentData>;
  abstract findById(id: number, userId: ID): Promise<PaymentData | null>;
  abstract findAll(userId: ID): Promise<PaymentData[]>;
  abstract findByStatus(status: string, userId: ID): Promise<PaymentData[]>;
  abstract findByInvoiceId(invoiceId: number, userId: ID): Promise<PaymentData[]>;
  abstract findByGatewayRef(gatewayRef: string, userId: ID): Promise<PaymentData | null>;
  abstract update(id: number, data: PaymentUpdateData, userId: ID): Promise<PaymentData>;
  abstract delete(id: number, userId: ID): Promise<void>;
}
