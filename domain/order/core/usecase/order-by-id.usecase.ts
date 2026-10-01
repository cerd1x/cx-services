import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { OrderRepository } from "../ports/out/order-repository.port";
import { Order } from "../../adapters/driven/drizzle/order.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type OrderByIdInput = {
  id: ID;
  userId: ID;
};

export class OrderByIdUseCase extends CoreUsecase<Order, OrderByIdInput> {
  @logMethod(logger)
  async execute(input: OrderByIdInput): Promise<Order> {
    const orderRepo = this.deps.get(OrderRepository);
    const { id, userId } = input;

    const order = await orderRepo.findById(id.toNumb, userId.toNumb);

    if (!order) {
      throw new NotFoundError(`Order with id ${id.toNumb}`);
    }

    return order;
  }
}