import { OrderRepository } from "../ports/out/order-repository.port";
import type { Order as OrderType } from "../../adapters/driven/drizzle/order.entity";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type OrdersByDateRangeInput = {
  start: Date;
  end: Date;
  userId: ID;
};

export class OrdersByDateRangeUseCase extends CoreUsecase<
  OrderType[],
  OrdersByDateRangeInput
> {
  @logMethod(logger)
  async execute(input: OrdersByDateRangeInput): Promise<OrderType[]> {
    const orderRepo = this.deps.get(OrderRepository);
    return orderRepo.findAllByDateRange(input.start, input.end, input.userId.toNumb);
  }
}