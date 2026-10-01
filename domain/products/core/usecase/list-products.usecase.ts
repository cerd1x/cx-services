import { ProductRepository } from "../ports/out/product-repository.port";
import type { Product as ProductType } from "../model/product.model";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListProductsUseCase extends CoreUsecase<ProductType[], number> {
  @logMethod(logger)
  async execute(userId: number): Promise<ProductType[]> {
    const productRepo = this.deps.get(ProductRepository);
    return productRepo.findAllByUserId(userId);
  }
}
