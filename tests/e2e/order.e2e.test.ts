import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type OrderDto = {
  id: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
};

describe("order e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("full order lifecycle: create, list, get, update, delete", async () => {
    const { session } = await signUpUser();

    const create = await gql<{ createOrder: OrderDto }>(
      `mutation($input: CreateOrderInput!) {
        createOrder(input: $input) { id status paymentMethod totalAmount currency itemCount }
      }`,
      {
        input: { totalAmount: 62500, currency: "IDR", itemCount: 2, paymentMethod: "cash" },
      },
      authHeaders(session),
    );
    expect(create.errors).toBeUndefined();
    expect(create.data!.createOrder.totalAmount).toBe(125000);
    expect(create.data!.createOrder.paymentMethod).toBe("cash");
    expect(create.data!.createOrder.status).toBe("pending");
    const orderId = create.data!.createOrder.id;
    expect(orderId).toBeTruthy();

    const list = await gql<{ orders: OrderDto[] }>(
      `{ orders { id status totalAmount itemCount } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.errors).toBeUndefined();
    expect(list.data!.orders.some((o) => o.id === orderId)).toBe(true);

    const get = await gql<{ order: OrderDto }>(
      `query($id: String!) { order(id: $id) { id status paymentMethod } }`,
      { id: orderId },
      authHeaders(session),
    );
    expect(get.errors).toBeUndefined();
    expect(get.data!.order.paymentMethod).toBe("cash");

    const update = await gql<{ updateOrder: OrderDto }>(
      `mutation($id: String!, $input: UpdateOrderInput!) {
        updateOrder(id: $id, input: $input) { id status }
      }`,
      { id: orderId, input: { status: "success" } },
      authHeaders(session),
    );
    expect(update.errors).toBeUndefined();
    expect(update.data!.updateOrder.status).toBe("success");

    const del = await gql<{ deleteOrder: boolean }>(
      `mutation($id: String!) { deleteOrder(id: $id) }`,
      { id: orderId },
      authHeaders(session),
    );
    expect(del.errors).toBeUndefined();
    expect(del.data!.deleteOrder).toBe(true);
  });

  it("createOrderProductSale deducts product stock", async () => {
    const { session } = await signUpUser();

    const prod = await gql<{ createProduct: { id: string; price: number; stock: number } }>(
      `mutation($input: CreateProductInput!) {
        createProduct(input: $input) { id price stock }
      }`,
      { input: { name: "Nasi Goreng", price: 50000, capital: 30000, stock: 3, trackStock: true } },
      authHeaders(session),
    );
    expect(prod.errors).toBeUndefined();
    const productId = prod.data!.createProduct.id;

    const sale = await gql<{ createOrderProductSale: OrderDto }>(
      `mutation($input: CreateOrderProductSaleInput!) {
        createOrderProductSale(input: $input) { id status totalAmount currency itemCount }
      }`,
      {
        input: {
          productId,
          itemCount: 1,
          totalAmount: 50000,
          currency: "IDR",
          paymentMethod: "cash",
        },
      },
      authHeaders(session),
    );
    expect(sale.errors).toBeUndefined();
    expect(sale.data!.createOrderProductSale.totalAmount).toBe(50000);

    const after = await gql<{ product: { id: string; stock: number } }>(
      `query($id: String!) { product(id: $id) { id stock } }`,
      { id: productId },
      authHeaders(session),
    );
    expect(after.errors).toBeUndefined();
    expect(after.data!.product.stock).toBe(2);
  });
});