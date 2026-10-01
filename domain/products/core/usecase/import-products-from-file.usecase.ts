import { ProductRepository } from "../ports/out/product-repository.port";
import { parseProductCSV } from "$services/shared/infra/parser";
import { CreateProductUseCase } from "./create-product.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ImportProductsFromFileResult = {
  imported: number;
  failed: number;
  merged: number;
};

export type ImportProductsFromFileInput = {
  userId: number;
  file: File;
};

export class ImportProductsFromFileUseCase extends CoreUsecase<
  ImportProductsFromFileResult,
  ImportProductsFromFileInput
> {
  @logMethod(logger)
  async execute(input: ImportProductsFromFileInput): Promise<ImportProductsFromFileResult> {
    const productRepo = this.deps.get(ProductRepository);
    const { userId, file } = input;

    const text = await file.text();
    const products = parseProductCSV(text);

    const existingProducts = await productRepo.findAllByUserId(userId);
    const existingMap = new Map(existingProducts.map((p) => [p.name.toLowerCase().trim(), p]));

    const seen = new Set<string>();
    let imported = 0;
    let failed = 0;
    let merged = 0;

    const createProduct = this.deps.get(CreateProductUseCase);

    for (const item of products) {
      try {
        if (!item.name || item.name.trim().length === 0) {
          failed++;
          continue;
        }

        const normalizedName = item.name.trim().toLowerCase();

        if (seen.has(normalizedName)) {
          continue;
        }
        seen.add(normalizedName);

        const existing = existingMap.get(normalizedName);

        if (existing) {
          let updated = false;
          if (item.price && item.price !== existing.price) {
            existing.price = item.price;
            updated = true;
          }
          if (item.capital !== undefined && item.capital !== existing.capital) {
            existing.capital = item.capital;
            updated = true;
          }
          if (item.currency && item.currency !== existing.currency) {
            existing.currency = item.currency;
            updated = true;
          }
          if (item.description !== undefined && item.description !== existing.description) {
            existing.description = item.description;
            updated = true;
          }
          if (item.stock !== undefined && item.stock !== existing.stock) {
            existing.stock = item.stock;
            updated = true;
          }
          if (updated) {
            existing.validateAll();
            await productRepo.update(existing, userId);
            merged++;
          }
        } else {
          const created = await createProduct.execute({
            userId,
            name: item.name.trim(),
            price: item.price,
            currency: item.currency,
            description: item.description,
            stock: item.stock,
            capital: item.capital,
          });
          existingMap.set(normalizedName, created);
          imported++;
        }
      } catch {
        failed++;
      }
    }
    return { imported, failed, merged };
  }
}