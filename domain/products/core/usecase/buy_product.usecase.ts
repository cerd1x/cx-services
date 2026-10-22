import { Money, findCurrency } from "@lib/money";
import { ProductRepository } from "../ports/out/product-repository.port";
import type { Product as ProductType } from "../model/product.model";
import { ID } from "$services/shared/kernel";
import { ProductByIdUseCase } from "./product_by_id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type BuyProductInput = {
  id: ID;
  count: number;
  userId: number;
  price?: Money;
};

export type BuyProductResult = {
  product: ProductType;
  count: number;
  amount: Money;
};

export class BuyProductUseCase extends CoreUsecase<BuyProductResult, BuyProductInput> {
  @logMethod(logger)
  async execute(input: BuyProductInput): Promise<BuyProductResult> {
    const productRepo = this.deps.get(ProductRepository);
    const { id, count, userId, price } = input;

    if (count <= 0) {
      throw new Error("Item count must be greater than zero");
    }

    const product = await this.deps.get(ProductByIdUseCase).execute({ id, userId });

    if (product.userId !== userId) {
      throw new Error("Product does not belong to this user");
    }

    const appliedPrice = price ?? this.#moneyFrom(product.price, product.currency);
    const amount = appliedPrice.multiply(count);

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

  #moneyFrom(amount: number, currencyCode: string): Money {
    const currency = findCurrency(currencyCode.toUpperCase());
    if (!currency) {
      throw new Error(`Unknown currency: ${currencyCode}`);
    }
    return Money.fromNumber(amount, currency);
  }
}
