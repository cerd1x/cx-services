import { eq, and, between } from "drizzle-orm";
import { Money, findCurrency } from "@lib/money";
import { getDB } from "$services/shared/infra/db";
import { orderTable } from "$services/shared/infra/db/drizzle-schema";
import { productTable } from "$services/shared/infra/db/drizzle-schema/product.schema";
import { Order } from "../../../core/model/order.model";
import {
  OrderRepository,
  OrderWithProduct,
} from "../../../core/ports/out/order-repository.port";

export class OrderRepositoryImpl implements OrderRepository {
  async save(order: Order): Promise<Order> {
    const result = await getDB()
      .insert(orderTable)
      .values({
        userId: order.userId!,
        productId: order.productId ?? null,
        status: order.status,
        paymentMethod: order.paymentMethod as
          | "cash"
          | "bank_transfer"
          | "ewallet"
          | "credit_card"
          | "debit_card"
          | "credit",
        totalAmount: order.totalAmount.toNumber(),
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        paidAmount: order.paidAmount.toNumber(),
        itemCount: order.itemCount,
        description: order.description ?? null,
        customerId: order.customerId ?? null,
      })
      .returning();

    return new Order({
      id: result[0].id,
      userId: result[0].userId ?? undefined,
      productId: result[0].productId ?? undefined,
      status: result[0].status as "pending" | "success" | "cancelled",
      paymentMethod: result[0].paymentMethod ?? "cash",
      price: this.#priceFromRow(result[0]),
      paidAmount: this.#paidAmountFromRow(result[0]),
      paymentStatus: result[0].paymentStatus as "unpaid" | "partial" | "paid",
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
    const rows = await getDB()
      .select()
      .from(orderTable)
      .where(eq(orderTable.userId, userId));

    return rows.map((r) => this.#toOrder(r));
  }

  async findAllByDateRange(
    start: Date,
    end: Date,
    userId: number,
  ): Promise<OrderWithProduct[]> {
    const rows = await getDB()
      .select({
        order: orderTable,
        productCapital: productTable.capital,
      })
      .from(orderTable)
      .leftJoin(productTable, eq(orderTable.productId, productTable.id))
      .where(
        and(
          eq(orderTable.userId, userId),
          between(orderTable.createdAt, start, end),
        ),
      );

    return rows.map((r) => {
      const order = this.#toOrder(r.order) as OrderWithProduct;
      order.productCapital = r.productCapital ?? undefined;
      return order;
    });
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
        totalAmount: order.totalAmount.toNumber(),
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        paidAmount: order.paidAmount.toNumber(),
        itemCount: order.itemCount,
        description: order.description ?? null,
        customerId: order.customerId ?? null,
      })
      .where(
        and(eq(orderTable.id, order.id!.decode), eq(orderTable.userId, userId)),
      )
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
      productId: row.productId ?? undefined,
      status: row.status as "pending" | "success" | "cancelled",
      paymentMethod: row.paymentMethod ?? "cash",
      price: this.#priceFromRow(row),
      paidAmount: this.#paidAmountFromRow(row),
      paymentStatus: row.paymentStatus as "unpaid" | "partial" | "paid",
      itemCount: row.itemCount,
      description: row.description ?? undefined,
      customerId: row.customerId ?? undefined,
      createdAt: row.createdAt,
    });
  }

  #priceFromRow(row: typeof orderTable.$inferSelect): Money {
    const currency = findCurrency(row.currency.toUpperCase());
    if (!currency) {
      throw new Error(`Unknown currency: ${row.currency}`);
    }
    return Money.fromNumber(row.totalAmount / row.itemCount, currency);
  }

  #paidAmountFromRow(row: typeof orderTable.$inferSelect): Money {
    const currency = findCurrency(row.currency.toUpperCase());
    if (!currency) {
      throw new Error(`Unknown currency: ${row.currency}`);
    }
    return Money.fromNumber(row.paidAmount, currency);
  }
}
