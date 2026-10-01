import { Product as ProductType } from "./core/model/product.model";
import { ID } from "$services/shared/kernel";
import { CreateProductUseCase } from "./core/usecase/create-product.usecase";
import { ProductByIdUseCase } from "./core/usecase/product-by-id.usecase";
import { BuyProductUseCase } from "./core/usecase/buy-product.usecase";
import { ListProductsUseCase } from "./core/usecase/list-products.usecase";
import { UpdateProductUseCase } from "./core/usecase/update-product.usecase";
import { DeleteProductUseCase } from "./core/usecase/delete-product.usecase";
import { ImportProductsFromFileUseCase } from "./core/usecase/import-products-from-file.usecase";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ServiceContainer } from "$services/shared/base";
import { ProductRepositoryImpl } from "./adapters/driven/drizzle/product.repository";
import { ProductRepository } from "./core/ports/out/product-repository.port";

export class ProductService {
  static #instanceProductService: ProductService;
  #createProduct: CreateProductUseCase;
  #productById: ProductByIdUseCase;
  #buyProduct: BuyProductUseCase;
  #listProducts: ListProductsUseCase;
  #updateProduct: UpdateProductUseCase;
  #deleteProduct: DeleteProductUseCase;
  #importFromFile: ImportProductsFromFileUseCase;

  @logMethod(logger)
  static init(
    createProduct: CreateProductUseCase,
    productById: ProductByIdUseCase,
    buyProduct: BuyProductUseCase,
    listProducts: ListProductsUseCase,
    updateProduct: UpdateProductUseCase,
    deleteProduct: DeleteProductUseCase,
    importFromFile: ImportProductsFromFileUseCase,
  ): ProductService {
    ProductService.#instanceProductService = new ProductService(
      createProduct,
      productById,
      buyProduct,
      listProducts,
      updateProduct,
      deleteProduct,
      importFromFile,
    );
    return ProductService.#instanceProductService;
  }

  @logMethod(logger)
  static getInstance(): ProductService {
    if (!ProductService.#instanceProductService) {
      throw new Error("ProductService not initialized");
    }
    return ProductService.#instanceProductService;
  }

  private constructor(
    createProduct: CreateProductUseCase,
    productById: ProductByIdUseCase,
    buyProduct: BuyProductUseCase,
    listProducts: ListProductsUseCase,
    updateProduct: UpdateProductUseCase,
    deleteProduct: DeleteProductUseCase,
    importFromFile: ImportProductsFromFileUseCase,
  ) {
    this.#createProduct = createProduct;
    this.#productById = productById;
    this.#buyProduct = buyProduct;
    this.#listProducts = listProducts;
    this.#updateProduct = updateProduct;
    this.#deleteProduct = deleteProduct;
    this.#importFromFile = importFromFile;
  }

  @logMethod(logger)
  async createProduct(
    userId: number,
    name: string,
    price: number,
    currency: string,
    description?: string,
    stock?: number,
    capital?: number,
    trackStock?: boolean,
  ): Promise<ProductType> {
    return this.#createProduct.execute({
      userId,
      name,
      price,
      currency,
      description,
      stock,
      capital,
      trackStock,
    });
  }

  @logMethod(logger)
  async product(id: ID, userId: number): Promise<ProductType> {
    return this.#productById.execute({ id, userId });
  }

  @logMethod(logger)
  async buy(
    id: ID,
    count: number,
    userId: number,
    price?: number,
  ): Promise<{ product: ProductType; count: number; amount: number }> {
    return this.#buyProduct.execute({ id, count, userId, price });
  }

  @logMethod(logger)
  async products(userId: number): Promise<ProductType[]> {
    return this.#listProducts.execute(userId);
  }

  @logMethod(logger)
  async updateProduct(
    id: ID,
    data: {
      name?: string;
      price?: number;
      capital?: number;
      currency?: string;
      description?: string;
      stock?: number;
      trackStock?: boolean;
    },
    userId: number,
  ): Promise<ProductType> {
    return this.#updateProduct.execute({ id, data, userId });
  }

  @logMethod(logger)
  async deleteProduct(id: ID, userId: number): Promise<void> {
    return this.#deleteProduct.execute({ id, userId });
  }

  @logMethod(logger)
  async importFromFile(
    userId: number,
    file: File,
  ): Promise<{ imported: number; failed: number; merged: number }> {
    return this.#importFromFile.execute({ userId, file });
  }
}

export type ProductAdapters = {
  productRepo: ProductRepository;
};

export function createProductService({ productRepo }: ProductAdapters): ProductService {
  const container = new ServiceContainer().set(ProductRepository, productRepo);

  const createProduct = new CreateProductUseCase().setContext(container);
  const productById = new ProductByIdUseCase().setContext(container);
  const buyProduct = new BuyProductUseCase().setContext(container);
  const listProducts = new ListProductsUseCase().setContext(container);
  const updateProduct = new UpdateProductUseCase().setContext(container);
  const deleteProduct = new DeleteProductUseCase().setContext(container);
  const importFromFile = new ImportProductsFromFileUseCase().setContext(container);

  container.set(ProductByIdUseCase, productById);
  container.set(CreateProductUseCase, createProduct);

  return ProductService.init(
    createProduct,
    productById,
    buyProduct,
    listProducts,
    updateProduct,
    deleteProduct,
    importFromFile,
  );
}

logger.info("Initializing ProductService...");
export const productService = createProductService({
  productRepo: new ProductRepositoryImpl(),
});
logger.info("ProductService initialized");
