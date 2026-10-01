import type { Product } from "../../model/product.model";

export abstract class ProductRepository {
  abstract save(product: Product): Promise<Product>;
  abstract findById(id: number, userId: number): Promise<Product | null>;
  abstract findAll(): Promise<Product[]>;
  abstract findAllByUserId(userId: number): Promise<Product[]>;
  abstract update(product: Product, userId: number): Promise<Product>;
  abstract delete(id: number, userId: number): Promise<void>;
}
