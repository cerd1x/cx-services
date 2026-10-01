import { eq, and, between } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { orderTable } from "$services/shared/infra/db/drizzle-schema";
import { Order } from "./order.entity";
import { OrderRepository } from "../../../core/ports/out/order-repository.port";

export class OrderRepositoryImpl implements OrderRepository {
  async save(order: Order): Promise<Order> {
    const result = await getDB()
      .insert(orderTable)
      .values({
        userId: order.userId!,
        status: order.status,
        paymentMethod: order.paymentMethod as
          | "cash"
          | "bank_transfer"
          | "ewallet"
          | "credit_card"
          | "debit_card"
          | "credit",
        totalAmount: order.totalAmount,
        currency: order.currency,
        itemCount: order.itemCount,
        description: order.description ?? null,
        customerId: order.customerId ?? null,
      })
      .returning();

    return new Order({
      id: result[0].id,
      userId: result[0].userId ?? undefined,
      status: result[0].status as "pending" | "success" | "cancelled",
      paymentMethod: result[0].paymentMethod ?? "cash",
      price: result[0].totalAmount / result[0].itemCount,
      currency: result[0].currency,
      itemCount: result[0].itemCount,
      description: result[0].description ?? undefined,
      customerId: result[0].customerId ?? undefined,
      createdAt: result[0].createdAt,
    });
  }

  async findById(id: number, userId: number): Promise<Order | null> {
    const rows = await getDB()
      .select()
      .from(orderTable)
      .where(and(eq(orderTable.id, id), eq(orderTable.userId, userId)))
      .limit(1);

    if (rows.length === 0) return null;

    return this.#toOrder(rows[0]);
  }

  async findAll(userId: number): Promise<Order[]> {
    const rows = await getDB().select().from(orderTable).where(eq(orderTable.userId, userId));

    return rows.map((r) => this.#toOrder(r));
  }

  async findAllByDateRange(start: Date, end: Date, userId: number): Promise<Order[]> {
    const rows = await getDB()
      .select()
      .from(orderTable)
      .where(and(eq(orderTable.userId, userId), between(orderTable.createdAt, start, end)));

    return rows.map((r) => this.#toOrder(r));
  }

  async update(order: Order, userId: number): Promise<Order> {
    const result = await getDB()
      .update(orderTable)
      .set({
        status: order.status,
        paymentMethod: order.paymentMethod as
          | "cash"
          | "bank_transfer"
          | "ewallet"
          | "credit_card"
          | "debit_card"
          | "credit",
        totalAmount: order.totalAmount,
        currency: order.currency,
        itemCount: order.itemCount,
        description: order.description ?? null,
        customerId: order.customerId ?? null,
      })
      .where(and(eq(orderTable.id, order.id!.toNumb), eq(orderTable.userId, userId)))
      .returning();

    return this.#toOrder(result[0]);
  }

  async delete(id: number, userId: number): Promise<void> {
    await getDB()
      .delete(orderTable)
      .where(and(eq(orderTable.id, id), eq(orderTable.userId, userId)));
  }

  #toOrder(row: typeof orderTable.$inferSelect): Order {
    return new Order({
      id: row.id,
      userId: row.userId ?? undefined,
      status: row.status as "pending" | "success" | "cancelled",
      paymentMethod: row.paymentMethod ?? "cash",
      price: row.totalAmount / row.itemCount,
      currency: row.currency,
      itemCount: row.itemCount,
      description: row.description ?? undefined,
      customerId: row.customerId ?? undefined,
      createdAt: row.createdAt,
    });
  }
}
