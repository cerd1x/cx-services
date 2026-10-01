import { and, eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { productTable } from "$services/shared/infra/db/drizzle-schema";
import { Product } from "../../../core/entity/product.entity";
import { ProductRepository } from "../../../core/ports/out/product-repository.port";

export class ProductRepositoryImpl implements ProductRepository {
  async save(product: Product): Promise<Product> {
    const result = await getDB()
      .insert(productTable)
      .values({
        userId: product.userId!,
        name: product.name,
        description: product.description ?? null,
        price: product.price,
        capital: product.capital ?? null,
        currency: product.currency,
        stock: product.stock,
        trackStock: product.trackStock ? 1 : 0,
      })
      .returning();

    return new Product({
      id: result[0].id,
      userId: result[0].userId ?? undefined,
      name: result[0].name,
      description: result[0].description ?? undefined,
      price: result[0].price,
      capital: result[0].capital ?? undefined,
      currency: result[0].currency,
      stock: result[0].stock,
      trackStock: result[0].trackStock === 1,
    });
  }

  async findById(id: number, userId: number): Promise<Product | null> {
    const rows = await getDB()
      .select()
      .from(productTable)
      .where(and(eq(productTable.id, id), eq(productTable.userId, userId)))
      .limit(1);
    if (rows.length === 0) return null;

    return new Product({
      id: rows[0].id,
      userId: rows[0].userId ?? undefined,
      name: rows[0].name,
      description: rows[0].description ?? undefined,
      price: rows[0].price,
      capital: rows[0].capital ?? undefined,
      currency: rows[0].currency,
      stock: rows[0].stock,
      trackStock: rows[0].trackStock === 1,
    });
  }

  async findAll(): Promise<Product[]> {
    const rows = await getDB().select().from(productTable);
    return rows.map(
      (r) =>
        new Product({
          id: r.id,
          userId: r.userId ?? undefined,
          name: r.name,
          description: r.description ?? undefined,
          price: r.price,
          capital: r.capital ?? undefined,
          currency: r.currency,
          stock: r.stock,
          trackStock: r.trackStock === 1,
        }),
    );
  }

  async findAllByUserId(userId: number): Promise<Product[]> {
    const rows = await getDB().select().from(productTable).where(eq(productTable.userId, userId));
    return rows.map(
      (r) =>
        new Product({
          id: r.id,
          userId: r.userId ?? undefined,
          name: r.name,
          description: r.description ?? undefined,
          price: r.price,
          capital: r.capital ?? undefined,
          currency: r.currency,
          stock: r.stock,
          trackStock: r.trackStock === 1,
        }),
    );
  }

  async update(product: Product, userId: number): Promise<Product> {
    const result = await getDB()
      .update(productTable)
      .set({
        userId: product.userId!,
        name: product.name,
        description: product.description ?? null,
        price: product.price,
        capital: product.capital ?? null,
        currency: product.currency,
        stock: product.stock,
        trackStock: product.trackStock ? 1 : 0,
      })
      .where(and(eq(productTable.id, product.id!.toNumb), eq(productTable.userId, userId)))
      .returning();

    return new Product({
      id: result[0].id,
      userId: result[0].userId ?? undefined,
      name: result[0].name,
      description: result[0].description ?? undefined,
      price: result[0].price,
      capital: result[0].capital ?? undefined,
      currency: result[0].currency,
      stock: result[0].stock,
      trackStock: result[0].trackStock === 1,
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    await getDB()
      .delete(productTable)
      .where(and(eq(productTable.id, id), eq(productTable.userId, userId)));
  }
}
