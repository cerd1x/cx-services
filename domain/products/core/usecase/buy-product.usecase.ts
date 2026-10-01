import { ProductRepository } from "../ports/out/product-repository.port";
import type { Product as ProductType } from "../model/product.model";
import { ID } from "$services/shared/kernel";
import { ProductByIdUseCase } from "./product-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type BuyProductInput = {
  id: ID;
  count: number;
  userId: number;
  price?: number;
};

export class BuyProductUseCase extends CoreUsecase<
  { product: ProductType; count: number; amount: number },
  BuyProductInput
> {
  @logMethod(logger)
  async execute(
    input: BuyProductInput,
  ): Promise<{ product: ProductType; count: number; amount: number }> {
    const productRepo = this.deps.get(ProductRepository);
    const { id, count, userId, price } = input;

    if (count <= 0) {
      throw new Error("Item count must be greater than zero");
    }

    const product = await this.deps.get(ProductByIdUseCase).execute({ id, userId });

    if (product.userId !== userId) {
      throw new Error("Product does not belong to this user");
    }

    const appliedPrice = price ?? product.price;
    const amount = appliedPrice * count;

    if (product.trackStock) {
      const availableStock = product.stock ?? 0;
      if (availableStock < count) {
        throw new Error(
          `Insufficient stock for product "${product.name}": available ${availableStock}, requested ${count}`,
        );
      }

      product.stock = availableStock - count;
      product.validateAll();
      const updated = await productRepo.update(product, userId);
      return { product: updated, count, amount };
    }

    return { product, count, amount };
  }
}
