import { ProductRepository } from "../ports/out/product-repository.port";
import { ID } from "$services/shared/kernel";
import { ProductByIdUseCase } from "./product-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeleteProductInput = {
  id: ID;
  userId: number;
};

export class DeleteProductUseCase extends CoreUsecase<void, DeleteProductInput> {
  @logMethod(logger)
  async execute(input: DeleteProductInput): Promise<void> {
    const productRepo = this.deps.get(ProductRepository);
    const { id, userId } = input;

    await this.deps.get(ProductByIdUseCase).execute({ id, userId });
    await productRepo.delete(id.toNumb, userId);
  }
}