import { OrderRepository } from "../ports/out/order-repository.port";
import { ID } from "$services/shared/kernel";
import { OrderByIdUseCase } from "./order-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeleteOrderInput = {
  id: ID;
  userId: ID;
};

export class DeleteOrderUseCase extends CoreUsecase<void, DeleteOrderInput> {
  @logMethod(logger)
  async execute(input: DeleteOrderInput): Promise<void> {
    const orderRepo = this.deps.get(OrderRepository);
    const { id, userId } = input;

    await this.deps.get(OrderByIdUseCase).execute({ id, userId });
    await orderRepo.delete(id.toNumb, userId.toNumb);
  }
}