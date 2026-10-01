import type { Order } from "../../../adapters/driven/drizzle/order.entity";

export abstract class OrderRepository {
  abstract save(order: Order): Promise<Order>;
  abstract findById(id: number, userId: number): Promise<Order | null>;
  abstract findAll(userId: number): Promise<Order[]>;
  abstract findAllByDateRange(start: Date, end: Date, userId: number): Promise<Order[]>;
  abstract update(order: Order, userId: number): Promise<Order>;
  abstract delete(id: number, userId: number): Promise<void>;
}
