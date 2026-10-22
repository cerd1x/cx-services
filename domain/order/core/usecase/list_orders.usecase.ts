import { OrderRepository } from "../ports/out/order-repository.port";
import type { Order as OrderType } from "../model/order.model";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListOrdersUseCase extends CoreUsecase<OrderType[], ID> {
  @logMethod(logger)
  async execute(userId: ID): Promise<OrderType[]> {
    const orderRepo = this.deps.get(OrderRepository);
    return orderRepo.findAll(userId.toNumb);
  }
}
