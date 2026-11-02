import type { ID } from "$services/shared/kernel";
import { Payment, type PaymentData, type PaymentUpdateData } from "../../model/payment.model";

export abstract class PaymentRepository {
  abstract save(payment: PaymentData): Promise<Payment>;
  abstract findById(id: number, userId: ID): Promise<Payment | null>;
  abstract findAll(userId: ID): Promise<Payment[]>;
  abstract findByStatus(status: string, userId: ID): Promise<Payment[]>;
  abstract findByInvoiceId(invoiceId: number, userId: ID): Promise<Payment[]>;
  abstract findByGatewayRef(gatewayRef: string, userId: ID): Promise<Payment | null>;
  abstract update(id: number, data: PaymentUpdateData, userId: ID): Promise<Payment>;
  abstract delete(id: number, userId: ID): Promise<void>;
}
