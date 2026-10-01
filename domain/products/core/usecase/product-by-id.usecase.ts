import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { ProductRepository } from "../ports/out/product-repository.port";
import type { Product as ProductType } from "../model/product.model";
import { ID } from "$services/shared/kernel";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ProductByIdInput = {
  id: ID;
  userId: number;
};

export class ProductByIdUseCase extends CoreUsecase<ProductType, ProductByIdInput> {
  @logMethod(logger)
  async execute(input: ProductByIdInput): Promise<ProductType> {
    const productRepo = this.deps.get(ProductRepository);
    const { id, userId } = input;

    const product = await productRepo.findById(id.toNumb, userId);
    if (!product) {
      throw new NotFoundError(`Product with id ${id.toNumb}`);
    }
    return product;
  }
}
