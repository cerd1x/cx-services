import {
  OrderRepository,
  OrderWithProduct,
} from "../ports/out/order-repository.port";
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
  OrderWithProduct[],
  OrdersByDateRangeInput
> {
  @logMethod(logger)
  async execute(input: OrdersByDateRangeInput): Promise<OrderWithProduct[]> {
    const orderRepo = this.deps.get(OrderRepository);
    return orderRepo.findAllByDateRange(
      input.start,
      input.end,
      input.userId.decode,
    );
  }
}
