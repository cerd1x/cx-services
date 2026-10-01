import { ProductRepository } from "../ports/out/product-repository.port";
import type { Product as ProductType } from "../entity/product.entity";
import { ID } from "$services/shared/kernel";
import { ProductByIdUseCase } from "./product-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateProductData = {
  name?: string;
  price?: number;
  capital?: number;
  currency?: string;
  description?: string;
  stock?: number;
  trackStock?: boolean;
};

export type UpdateProductInput = {
  id: ID;
  data: UpdateProductData;
  userId: number;
};

export class UpdateProductUseCase extends CoreUsecase<ProductType, UpdateProductInput> {
  @logMethod(logger)
  async execute(input: UpdateProductInput): Promise<ProductType> {
    const productRepo = this.deps.get(ProductRepository);
    const { id, data, userId } = input;

    const existing = await this.deps.get(ProductByIdUseCase).execute({ id, userId });

    if (data.name !== undefined) existing.name = data.name;
    if (data.price !== undefined) existing.price = data.price;
    if (data.capital !== undefined) existing.capital = data.capital;
    if (data.currency !== undefined) existing.currency = data.currency;
    if (data.description !== undefined) existing.description = data.description;
    if (data.stock !== undefined) existing.stock = data.stock;
    if (data.trackStock !== undefined) existing.trackStock = data.trackStock;

    existing.validateAll();
    return productRepo.update(existing, userId);
  }
}
