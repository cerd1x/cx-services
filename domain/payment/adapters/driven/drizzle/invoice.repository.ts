import type { InvoiceData } from "../../../core/model/invoice.model";
import { invoiceTable } from "$services/shared/infra/db/drizzle-schema";
import { ID } from "$services/shared/kernel";
import { eq, and } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import type { InvoiceRepository } from "../../../core/ports/out/invoice-repository.port";

export class InvoiceRepositoryImpl implements InvoiceRepository {
  async save(invoice: InvoiceData): Promise<InvoiceData> {
    const result = await getDB()
      .insert(invoiceTable)
      .values({
        userId: invoice.userId,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId ?? null,
        items: JSON.stringify(invoice.items),
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        status: invoice.status,
        issuedAt: invoice.issuedAt ?? null,
        dueAt: invoice.dueAt ?? null,
        paidAt: invoice.paidAt ?? null,
        description: invoice.description ?? null,
        metadata: invoice.metadata ? JSON.stringify(invoice.metadata) : null,
        createdAt: invoice.createdAt ?? new Date(),
      })
      .returning();

    return this.#toInvoice(result[0]);
  }

  async findById(id: number, userId: ID): Promise<InvoiceData | null> {
    const rows = await getDB()
      .select()
      .from(invoiceTable)
      .where(and(eq(invoiceTable.id, id), eq(invoiceTable.userId, userId.toNumb)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.#toInvoice(rows[0]);
  }

  async findByInvoiceNumber(invoiceNumber: string, userId: ID): Promise<InvoiceData | null> {
    const rows = await getDB()
      .select()
      .from(invoiceTable)
      .where(
        and(eq(invoiceTable.invoiceNumber, invoiceNumber), eq(invoiceTable.userId, userId.toNumb)),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.#toInvoice(rows[0]);
  }

  async findAll(userId: ID): Promise<InvoiceData[]> {
    const rows = await getDB()
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.userId, userId.toNumb));
    return rows.map((r) => this.#toInvoice(r));
  }

  async findByStatus(status: string, userId: ID): Promise<InvoiceData[]> {
    const rows = await getDB()
      .select()
      .from(invoiceTable)
      .where(and(eq(invoiceTable.status, status as any), eq(invoiceTable.userId, userId.toNumb)));
    return rows.map((r) => this.#toInvoice(r));
  }

  async update(id: number, data: Partial<InvoiceData>, userId: ID): Promise<InvoiceData> {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueAt !== undefined) updateData.dueAt = data.dueAt;
    if (data.paidAt !== undefined) updateData.paidAt = data.paidAt;
    if (data.issuedAt !== undefined) updateData.issuedAt = data.issuedAt;
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);

    const result = await getDB()
      .update(invoiceTable)
      .set(updateData)
      .where(and(eq(invoiceTable.id, id), eq(invoiceTable.userId, userId.toNumb)))
      .returning();

    return this.#toInvoice(result[0]);
  }

  async delete(id: number, userId: ID): Promise<void> {
    await getDB()
      .delete(invoiceTable)
      .where(and(eq(invoiceTable.id, id), eq(invoiceTable.userId, userId.toNumb)));
  }

  #parseMetadata(raw: string | null | undefined): Record<string, unknown> | undefined {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return raw as unknown as Record<string, unknown>;
    }
  }

  #toInvoice(row: typeof invoiceTable.$inferSelect): InvoiceData {
    return {
      id: row.id,
      userId: row.userId,
      invoiceNumber: row.invoiceNumber,
      customerId: row.customerId ?? undefined,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      subtotal: row.subtotal,
      tax: row.tax,
      totalAmount: row.totalAmount,
      currency: row.currency,
      status: row.status as InvoiceData["status"],
      issuedAt: row.issuedAt ?? undefined,
      dueAt: row.dueAt ?? undefined,
      paidAt: row.paidAt ?? undefined,
      description: row.description ?? undefined,
      metadata: this.#parseMetadata(row.metadata),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
    };
  }
}
