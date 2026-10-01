import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type ProductDto = {
  id: string;
  name: string;
  price: number;
  capital: number | null;
  margin: number;
  currency: string;
  stock: number;
  trackStock: boolean;
};

describe("product e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("creates a product using the user's default currency", async () => {
    const { session } = await signUpUser();

    const create = await gql<{ createProduct: ProductDto }>(
      `mutation($input: CreateProductInput!) {
        createProduct(input: $input) { id name price capital margin currency stock trackStock }
      }`,
      { input: { name: "Kopi Susu", price: 25000, capital: 15000, stock: 5, trackStock: true } },
      authHeaders(session),
    );
    expect(create.errors).toBeUndefined();
    expect(create.data!.createProduct.name).toBe("Kopi Susu");
    expect(create.data!.createProduct.price).toBe(25000);
    expect(create.data!.createProduct.currency).toBe("IDR");
    expect(create.data!.createProduct.stock).toBe(5);
    expect(create.data!.createProduct.margin).toBe(10000);

    const id = create.data!.createProduct.id;
    expect(id).toBeTruthy();

    const list = await gql<{ products: ProductDto[] }>(
      `{ products { id name price margin stock } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.errors).toBeUndefined();
    expect(list.data!.products.some((p) => p.name === "Kopi Susu")).toBe(true);

    const get = await gql<{ product: ProductDto }>(
      `query($id: String!) { product(id: $id) { id name price margin stock } }`,
      { id },
      authHeaders(session),
    );
    expect(get.errors).toBeUndefined();
    expect(get.data!.product.price).toBe(25000);

    const update = await gql<{ updateProduct: ProductDto }>(
      `mutation($id: String!, $input: UpdateProductInput!) {
        updateProduct(id: $id, input: $input) { id price stock }
      }`,
      { id, input: { price: 30000, stock: 4 } },
      authHeaders(session),
    );
    expect(update.errors).toBeUndefined();
    expect(update.data!.updateProduct.price).toBe(30000);
    expect(update.data!.updateProduct.stock).toBe(4);

    const del = await gql<{ deleteProduct: boolean }>(
      `mutation($id: String!) { deleteProduct(id: $id) }`,
      { id },
      authHeaders(session),
    );
    expect(del.errors).toBeUndefined();
    expect(del.data!.deleteProduct).toBe(true);

    const afterDelete = await gql<{ products: ProductDto[] }>(
      `{ products { id name } }`,
      undefined,
      authHeaders(session),
    );
    expect(afterDelete.data!.products.some((p) => p.name === "Kopi Susu")).toBe(false);
  });
});