import type { PaymentData } from "./payment.entity";
import { paymentTable } from "$services/shared/infra/db/drizzle-schema";
import { ID } from "$services/shared/kernel";
import { eq, and } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import type { PaymentRepository } from "../../../core/ports/out/payment-repository.port";

export class PaymentRepositoryImpl implements PaymentRepository {
  async save(payment: PaymentData): Promise<PaymentData> {
    const result = await getDB()
      .insert(paymentTable)
      .values({
        userId: payment.userId,
        invoiceId: payment.invoiceId ?? null,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        gatewayRef: payment.gatewayRef ?? null,
        description: payment.description ?? null,
        retryCount: payment.retryCount,
        maxRetries: payment.maxRetries,
        metadata: payment.metadata ? JSON.stringify(payment.metadata) : null,
        createdAt: payment.createdAt ?? new Date(),
      })
      .returning();

    return this.#toPayment(result[0]);
  }

  async findById(id: number, userId: ID): Promise<PaymentData | null> {
    const rows = await getDB()
      .select()
      .from(paymentTable)
      .where(and(eq(paymentTable.id, id), eq(paymentTable.userId, userId.toNumb)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.#toPayment(rows[0]);
  }

  async findAll(userId: ID): Promise<PaymentData[]> {
    const rows = await getDB()
      .select()
      .from(paymentTable)
      .where(eq(paymentTable.userId, userId.toNumb));
    return rows.map((r) => this.#toPayment(r));
  }

  async findByStatus(status: string, userId: ID): Promise<PaymentData[]> {
    const rows = await getDB()
      .select()
      .from(paymentTable)
      .where(and(eq(paymentTable.status, status as any), eq(paymentTable.userId, userId.toNumb)));
    return rows.map((r) => this.#toPayment(r));
  }

  async findByInvoiceId(invoiceId: number, userId: ID): Promise<PaymentData[]> {
    const rows = await getDB()
      .select()
      .from(paymentTable)
      .where(and(eq(paymentTable.invoiceId, invoiceId), eq(paymentTable.userId, userId.toNumb)));
    return rows.map((r) => this.#toPayment(r));
  }

  async findByGatewayRef(gatewayRef: string, userId: ID): Promise<PaymentData | null> {
    const rows = await getDB()
      .select()
      .from(paymentTable)
      .where(and(eq(paymentTable.gatewayRef, gatewayRef), eq(paymentTable.userId, userId.toNumb)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.#toPayment(rows[0]);
  }

  async update(id: number, data: Partial<PaymentData>, userId: ID): Promise<PaymentData> {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.gatewayRef !== undefined) updateData.gatewayRef = data.gatewayRef;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.retryCount !== undefined) updateData.retryCount = data.retryCount;
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);

    const result = await getDB()
      .update(paymentTable)
      .set(updateData)
      .where(and(eq(paymentTable.id, id), eq(paymentTable.userId, userId.toNumb)))
      .returning();

    return this.#toPayment(result[0]);
  }

  async delete(id: number, userId: ID): Promise<void> {
    await getDB()
      .delete(paymentTable)
      .where(and(eq(paymentTable.id, id), eq(paymentTable.userId, userId.toNumb)));
  }

  #parseMetadata(raw: string | null | undefined): Record<string, unknown> | undefined {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return raw as unknown as Record<string, unknown>;
    }
  }

  #toPayment(row: typeof paymentTable.$inferSelect): PaymentData {
    return {
      id: row.id,
      userId: row.userId,
      invoiceId: row.invoiceId ?? undefined,
      amount: row.amount,
      currency: row.currency,
      method: row.method as PaymentData["method"],
      status: row.status as PaymentData["status"],
      gatewayRef: row.gatewayRef ?? undefined,
      description: row.description ?? undefined,
      retryCount: row.retryCount,
      maxRetries: row.maxRetries,
      metadata: this.#parseMetadata(row.metadata),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
    };
  }
}
