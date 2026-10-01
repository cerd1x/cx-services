import { OrderRepository } from "../ports/out/order-repository.port";
import { Order } from "../model/order.model";
import type { Order as OrderType } from "../model/order.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type CreateOrderInput = {
  userId?: number;
  price: number;
  currency: string;
  itemCount: number;
  paymentMethod?: string;
  description?: string;
  customerId?: number;
};

export class CreateOrderUseCase extends CoreUsecase<OrderType, CreateOrderInput> {
  @logMethod(logger)
  async execute(input: CreateOrderInput): Promise<OrderType> {
    const orderRepo = this.deps.get(OrderRepository);

    let order = Order.new({ ...input }).validateAll();
    order = await orderRepo.save(order);

    if (!order.id) {
      throw new Error("Failed to create order: no id returned");
    }

    return order;
  }
}
