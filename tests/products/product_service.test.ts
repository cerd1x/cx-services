import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { createProductService, ProductService } from "$services/domain/products";
import { Product } from "$services/domain/products/core/entity/product.entity";
import { ID } from "$services/shared/kernel/id";

describe("ProductService", () => {
  const productRepo = {
    save: mock(),
    findById: mock(),
    findAll: mock(),
    findAllByUserId: mock(),
    update: mock(),
    delete: mock(),
  };

  beforeAll(() => {
    createProductService({ productRepo: productRepo as any });
  });

  afterEach(() => {
    for (const m of Object.values(productRepo)) (m as any).mockClear();
  });

  describe("createProduct", () => {
    it("creates and saves a product", async () => {
      productRepo.save.mockImplementation(async (p: Product) => {
        p.id = ID.new(1);
        return p;
      });

      const result = await ProductService.getInstance().createProduct(
        1,
        "Coffee",
        25000,
        "IDR",
        "Special blend",
        100,
      );

      expect(result.id?.toNumb).toBe(1);
      expect(result.name).toBe("Coffee");
      expect(result.price).toBe(25000);
      expect(productRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Coffee", price: 25000 }),
      );
    });

    it("creates without optional fields", async () => {
      productRepo.save.mockImplementation(async (p: Product) => {
        p.id = ID.new(1);
        return p;
      });

      const result = await ProductService.getInstance().createProduct(1, "Sugar", 10000, "IDR");

      expect(result.name).toBe("Sugar");
      expect(result.stock).toBe(0);
      expect(result.trackStock).toBe(true);
    });

    it("creates product with trackStock disabled", async () => {
      productRepo.save.mockImplementation(async (p: Product) => {
        p.id = ID.new(1);
        return p;
      });

      const result = await ProductService.getInstance().createProduct(
        1,
        "Consultation",
        50000,
        "IDR",
        undefined,
        undefined,
        undefined,
        false,
      );

      expect(result.trackStock).toBe(false);
    });

    it("throws when no id returned", async () => {
      productRepo.save.mockResolvedValue({} as any);

      await expect(
        ProductService.getInstance().createProduct(1, "Fail", 100, "IDR"),
      ).rejects.toThrow("Failed to create product: no id returned");
    });

    it("throws on invalid price", async () => {
      await expect(ProductService.getInstance().createProduct(1, "Neg", -1, "IDR")).rejects.toThrow(
        "Price must be positive",
      );
      expect(productRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("product", () => {
    it("returns product when found", async () => {
      const p = new Product({ name: "Coffee", price: 25000, currency: "IDR", stock: 50 });
      p.id = ID.new(1);
      productRepo.findById.mockResolvedValue(p);

      const result = await ProductService.getInstance().product(ID.new(1), 1);

      expect(result.id?.toNumb).toBe(1);
      expect(result.name).toBe("Coffee");
      expect(productRepo.findById).toHaveBeenCalledWith(1, 1);
    });

    it("throws NotFoundError when not found", async () => {
      productRepo.findById.mockResolvedValue(null);

      await expect(ProductService.getInstance().product(ID.new(999), 1)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError when product belongs to another user", async () => {
      const p = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 50,
        userId: 2,
      });
      p.id = ID.new(1);
      productRepo.findById.mockResolvedValue(null);

      await expect(ProductService.getInstance().product(ID.new(1), 2)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("products", () => {
    it("returns products for user", async () => {
      const p1 = new Product({
        name: "Coffee",
        price: 25000,
        currency: "IDR",
        stock: 50,
        userId: 1,
      });
      p1.id = ID.new(1);
      const p2 = new Product({ name: "Tea", price: 15000, currency: "IDR", stock: 30, userId: 1 });
      p2.id = ID.new(2);
      productRepo.findAllByUserId.mockResolvedValue([p1, p2]);

      const result = await ProductService.getInstance().products(1);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Coffee");
      expect(result[1].name).toBe("Tea");
    });
  });

  describe("updateProduct", () => {
    it("updates product fields", async () => {
      const existing = new Product({
        name: "Old Coffee",
        price: 20000,
        currency: "IDR",
        stock: 10,
        userId: 1,
      });
      existing.id = ID.new(1);
      productRepo.findById.mockResolvedValue(existing);
      productRepo.update.mockImplementation(async (p) => p);

      const result = await ProductService.getInstance().updateProduct(
        ID.new(1),
        {
          name: "Premium Coffee",
          price: 30000,
        },
        1,
      );

      expect(result.name).toBe("Premium Coffee");
      expect(productRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Premium Coffee", price: 30000 }),
        1,
      );
    });

    it("throws NotFoundError when product not found", async () => {
      productRepo.findById.mockResolvedValue(null);

      await expect(
        ProductService.getInstance().updateProduct(ID.new(999), { name: "Ghost" }, 1),
      ).rejects.toThrow(NotFoundError);
      expect(productRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteProduct", () => {
    it("deletes product by id", async () => {
      const p = new Product({ name: "To Delete", price: 1000, currency: "IDR", stock: 0 });
      p.id = ID.new(1);
      productRepo.findById.mockResolvedValue(p);
      productRepo.delete.mockResolvedValue(undefined);

      await ProductService.getInstance().deleteProduct(ID.new(1), 1);

      expect(productRepo.delete).toHaveBeenCalledWith(1, 1);
    });

    it("throws NotFoundError when product to delete not found", async () => {
      productRepo.findById.mockResolvedValue(null);

      await expect(ProductService.getInstance().deleteProduct(ID.new(999), 1)).rejects.toThrow(
        NotFoundError,
      );
      expect(productRepo.delete).not.toHaveBeenCalled();
    });
  });
});
