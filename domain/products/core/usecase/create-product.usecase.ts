import { ProductRepository } from "../ports/out/product-repository.port";
import { Product } from "../entity/product.entity";
import type { Product as ProductType } from "../entity/product.entity";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type CreateProductInput = {
  userId: number;
  name: string;
  price: number;
  currency: string;
  description?: string;
  stock?: number;
  capital?: number;
  trackStock?: boolean;
};

export class CreateProductUseCase extends CoreUsecase<ProductType, CreateProductInput> {
  @logMethod(logger)
  async execute(input: CreateProductInput): Promise<ProductType> {
    const productRepo = this.deps.get(ProductRepository);
    let { userId, name, price, currency, description, stock, capital, trackStock } = input;

    let product = Product.new({
      userId,
      name,
      price,
      capital,
      currency,
      description,
      stock,
      trackStock,
    }).validateAll();
    product = await productRepo.save(product);

    if (!product.id) {
      throw new Error("Failed to create product: no id returned");
    }

    return product;
  }
}
