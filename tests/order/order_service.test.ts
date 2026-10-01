import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { createOrderService, OrderService } from "$services/domain/order";
import { Order } from "$services/domain/order/core/entity/order.entity";
import { Product } from "$services/domain/products/core/entity/product.entity";
import { ID } from "$services/shared/kernel/id";
import { createProductService, ProductService } from "$services/domain/products";
import { createTransactionService, TransactionService } from "$services/domain/transactions";
import type { PaymentService } from "$services/domain/payment";
import { mockAssetSwapGateway } from "../utils/outbox.mock";

describe("OrderService", () => {
  const orderRepo = {
    save: mock(),
    findById: mock(),
    findAll: mock(),
    findAllByDateRange: mock(),
    update: mock(),
    delete: mock(),
  };

  const productRepo = {
    save: mock(),
    findById: mock(),
    findAll: mock(),
    findAllByUserId: mock(),
    update: mock(),
    delete: mock(),
  };

  const txRepo = {
    save: mock(),
    findById: mock(),
    findAll: mock(),
    findByType: mock(),
    findByDateRange: mock(),
    update: mock(),
    delete: mock(),
    findByName: mock(),
    createTransactionMutation: mock(),
  };

  const userId = ID.new(1);

  const fakePaymentService = {
    createInvoice: mock(async () => ({
      id: ID.new(900),
      userId: 1,
      invoiceNumber: "INV-TEST",
      items: [],
      subtotal: 0,
      tax: 0,
      totalAmount: 50000,
      currency: "IDR",
      status: "issued",
    })),
    processPayment: mock(async () => ({
      id: ID.new(901),
      userId: 1,
      amount: 50000,
      currency: "IDR",
      method: "cash",
      status: "completed",
      gatewayRef: "mock_test",
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    })),
  } as unknown as PaymentService;

  beforeAll(() => {
    createOrderService({ orderRepo: orderRepo as any, payment: fakePaymentService });
    createProductService({ productRepo: productRepo as any });
    createTransactionService({ txRepo: txRepo as any, assetGateway: mockAssetSwapGateway });
  });

  afterEach(() => {
    for (const m of Object.values(orderRepo)) (m as any).mockClear();
    for (const m of Object.values(productRepo)) (m as any).mockClear();
    for (const m of Object.values(txRepo)) (m as any).mockClear();
    (fakePaymentService as any).createInvoice.mockClear();
    (fakePaymentService as any).processPayment.mockClear();
  });

  describe("createOrderProductSale", () => {
    it("creates a product sale with full flow", async () => {
      const product = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 50,
        capital: 15000,
        userId: 1,
      });
      product.id = ID.new(1);
      productRepo.findById.mockResolvedValue(product);
      productRepo.update.mockImplementation(async (p) => p);

      txRepo.save.mockImplementation(async (t: any) => {
        t.id = ID.new(10);
        return t;
      });

      let savedOrderStatus = "";
      let savedOrderTotalAmount = 0;

      orderRepo.save.mockImplementation(async (o: Order) => {
        savedOrderStatus = o.status;
        savedOrderTotalAmount = o.totalAmount;
        o.id = ID.new(100);
        return o;
      });

      orderRepo.update.mockImplementation(async (o) => o);

      const result = await OrderService.getInstance().createOrderProductSale({
        userId: 1,
        productId: ID.new(1),
        itemCount: 2,
        price: 50000,
        currency: "IDR",
        customerId: 5,
        description: "Test sale",
      });

      expect(result.id?.toNumb).toBe(100);
      expect(result.totalAmount).toBe(100000);
      expect(result.itemCount).toBe(2);
      expect(result.status).toBe("success");
      expect(productRepo.update).toHaveBeenCalledWith(expect.objectContaining({ stock: 48 }), 1);
      expect(savedOrderStatus).toBe("pending");
      expect(savedOrderTotalAmount).toBe(100000);
      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 100000, itemCount: 2, status: "success" }),
        1,
      );
      expect(fakePaymentService.createInvoice).toHaveBeenCalled();
      expect(fakePaymentService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100000, currency: "IDR", method: "cash" }),
      );
      expect(txRepo.save).toHaveBeenCalledTimes(1);
    });

    it("throws when product not found", async () => {
      productRepo.findById.mockResolvedValue(null);

      await expect(
        OrderService.getInstance().createOrderProductSale({
          userId: 1,
          productId: ID.new(999),
          itemCount: 1,
          price: 100,
          currency: "IDR",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws when product belongs to another user", async () => {
      const product = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 10,
        userId: 2,
      });
      product.id = ID.new(1);
      productRepo.findById.mockResolvedValue(product);

      await expect(
        OrderService.getInstance().createOrderProductSale({
          userId: 1,
          productId: ID.new(1),
          itemCount: 1,
          price: 25000,
          currency: "IDR",
        }),
      ).rejects.toThrow("Product does not belong to this user");
    });

    it("throws when insufficient stock", async () => {
      const product = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 1,
        userId: 1,
      });
      product.id = ID.new(1);
      productRepo.findById.mockResolvedValue(product);

      await expect(
        OrderService.getInstance().createOrderProductSale({
          userId: 1,
          productId: ID.new(1),
          itemCount: 5,
          price: 125000,
          currency: "IDR",
        }),
      ).rejects.toThrow("Insufficient stock");
    });

    it("does not create transaction when stock update fails", async () => {
      const product = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 50,
        capital: 15000,
        userId: 1,
      });
      product.id = ID.new(1);
      productRepo.findById.mockResolvedValue(product);

      const txRepoSpy = txRepo.save;

      orderRepo.save.mockImplementation(async (o: Order) => {
        o.id = ID.new(100);
        return o;
      });
      orderRepo.update.mockImplementation(async (o) => o);

      productRepo.update.mockRejectedValueOnce(new Error("DB write failed"));

      await expect(
        OrderService.getInstance().createOrderProductSale({
          userId: 1,
          productId: ID.new(1),
          itemCount: 2,
          price: 50000,
          currency: "IDR",
        }),
      ).rejects.toThrow("DB write failed");

      expect(productRepo.update).toHaveBeenCalledTimes(1);
      expect(txRepoSpy).not.toHaveBeenCalled();
      expect(txRepo.delete).not.toHaveBeenCalled();
      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled" }),
        1,
      );
    });

    it("fails fast when order save fails (no payment, no stock, no transaction)", async () => {
      const product = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 50,
        capital: 15000,
        userId: 1,
      });
      product.id = ID.new(1);
      productRepo.findById.mockResolvedValue(product);

      orderRepo.save.mockRejectedValue(new Error("Order save failed"));

      await expect(
        OrderService.getInstance().createOrderProductSale({
          userId: 1,
          productId: ID.new(1),
          itemCount: 2,
          price: 50000,
          currency: "IDR",
        }),
      ).rejects.toThrow("Order save failed");

      expect(orderRepo.save).toHaveBeenCalledTimes(1);
      expect(fakePaymentService.createInvoice).not.toHaveBeenCalled();
      expect(fakePaymentService.processPayment).not.toHaveBeenCalled();
      expect(productRepo.update).not.toHaveBeenCalled();
      expect(txRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("createOrder", () => {
    it("creates and saves an order", async () => {
      orderRepo.save.mockImplementation(async (o: Order) => {
        o.id = ID.new(1);
        return o;
      });

      const result = await OrderService.getInstance().createOrder({
        userId: 1,
        price: 50000,
        currency: "IDR",
        itemCount: 2,
      });

      expect(result.id?.toNumb).toBe(1);
      expect(result.totalAmount).toBe(100000);
      expect(result.currency).toBe("IDR");
      expect(result.itemCount).toBe(2);
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 100000, currency: "IDR", itemCount: 2 }),
      );
    });

    it("creates order with paymentMethod and description", async () => {
      orderRepo.save.mockImplementation(async (o: Order) => {
        o.id = ID.new(2);
        return o;
      });

      const result = await OrderService.getInstance().createOrder({
        userId: 1,
        price: 75000,
        currency: "IDR",
        itemCount: 3,
        paymentMethod: "cash",
        description: "Coffee order",
      });

      expect(result.paymentMethod).toBe("cash");
      expect(result.description).toBe("Coffee order");
    });

    it("throws when no id returned", async () => {
      orderRepo.save.mockResolvedValue({} as any);

      await expect(
        OrderService.getInstance().createOrder({
          userId: 1,
          price: 100,
          currency: "IDR",
          itemCount: 1,
        }),
      ).rejects.toThrow("Failed to create order: no id returned");
    });

    it("throws on invalid totalAmount", async () => {
      await expect(
        OrderService.getInstance().createOrder({
          userId: 1,
          price: -1,
          currency: "IDR",
          itemCount: 1,
        }),
      ).rejects.toThrow("Price must be positive");
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("throws on invalid itemCount", async () => {
      await expect(
        OrderService.getInstance().createOrder({
          userId: 1,
          price: 100,
          currency: "IDR",
          itemCount: 0,
        }),
      ).rejects.toThrow("Item count must be positive");
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("order", () => {
    it("returns order when found", async () => {
      const o = new Order({ price: 50000, currency: "IDR", itemCount: 2 });
      o.id = ID.new(1);
      o.userId = 1;
      orderRepo.findById.mockResolvedValue(o);

      const result = await OrderService.getInstance().order(ID.new(1), userId);

      expect(result.id?.toNumb).toBe(1);
      expect(result.totalAmount).toBe(100000);
    });

    it("throws NotFoundError when not found", async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(OrderService.getInstance().order(ID.new(999), userId)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("orders", () => {
    it("returns orders for user", async () => {
      const o1 = new Order({ price: 50000, currency: "IDR", itemCount: 2, userId: 1 });
      o1.id = ID.new(1);
      const o2 = new Order({ price: 30000, currency: "IDR", itemCount: 1, userId: 1 });
      o2.id = ID.new(2);
      orderRepo.findAll.mockResolvedValue([o1, o2]);

      const result = await OrderService.getInstance().orders(userId);

      expect(result).toHaveLength(2);
      expect(result[0].totalAmount).toBe(100000);
      expect(result[1].totalAmount).toBe(30000);
    });
  });

  describe("ordersByDateRange", () => {
    it("returns orders within date range", async () => {
      const start = new Date("2026-01-01");
      const end = new Date("2026-12-31");
      const o = new Order({ price: 50000, currency: "IDR", itemCount: 2 });
      o.id = ID.new(1);
      orderRepo.findAllByDateRange.mockResolvedValue([o]);

      const result = await OrderService.getInstance().ordersByDateRange(start, end, userId);

      expect(result).toHaveLength(1);
      expect(orderRepo.findAllByDateRange).toHaveBeenCalledWith(start, end, 1);
    });
  });

  describe("updateOrder", () => {
    it("updates order fields", async () => {
      const existing = new Order({
        price: 50000,
        currency: "IDR",
        itemCount: 2,
      });
      existing.id = ID.new(1);
      existing.userId = 1;
      orderRepo.findById.mockResolvedValue(existing);
      orderRepo.update.mockImplementation(async (o) => o);

      const result = await OrderService.getInstance().updateOrder(
        ID.new(1),
        { status: "success", description: "Paid" },
        userId,
      );

      expect(result.status).toBe("success");
      expect(result.description).toBe("Paid");
      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success", description: "Paid" }),
        1,
      );
    });

    it("throws NotFoundError when order not found", async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(
        OrderService.getInstance().updateOrder(ID.new(999), { status: "cancelled" }, userId),
      ).rejects.toThrow(NotFoundError);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteOrder", () => {
    it("deletes order by id", async () => {
      const existing = new Order({ price: 1000, currency: "IDR", itemCount: 1 });
      existing.id = ID.new(1);
      existing.userId = 1;
      orderRepo.findById.mockResolvedValue(existing);
      orderRepo.delete.mockResolvedValue(undefined);

      await OrderService.getInstance().deleteOrder(ID.new(1), userId);

      expect(orderRepo.delete).toHaveBeenCalledWith(1, 1);
    });

    it("throws NotFoundError when order to delete not found", async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(OrderService.getInstance().deleteOrder(ID.new(999), userId)).rejects.toThrow(
        NotFoundError,
      );
      expect(orderRepo.delete).not.toHaveBeenCalled();
    });
  });
});
