import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AdminService, createAdminService } from "$services/domain/admin";
import type { AdminRepository } from "$services/domain/admin/core/ports/out/admin-repository.port";
import type { UserServiceCtx } from "$services/domain/admin/core/usecase/ctx";
import { ADMIN_PAGE_MAX_LIMIT } from "$services/domain/admin";
import { ID } from "$services/shared/kernel";
import { ValidationError } from "$services/shared/kernel/errors/service-error";

describe("AdminService dengan mock repository", () => {
  const mockAdminRepo = {
    listUsers: mock(async () => [
      {
        id: 1,
        name: "Hady",
        username: "cerdix",
        email: "cerdix@example.com",
        role: "admin" as const,
        avatarUrl: null,
        createdAt: new Date("2026-10-08T10:19:48Z"),
      },
      {
        id: 2,
        name: "Budi",
        username: "budi",
        email: "budi@example.com",
        role: "user" as const,
        avatarUrl: null,
        createdAt: new Date("2026-10-09T10:19:48Z"),
      },
    ]),
    getOverview: mock(async () => ({
      totalUsers: 2,
      totalAdmins: 1,
      totalTransactions: 7,
      totalAssets: 3,
      totalIncome: 120_000,
      totalExpense: 45_000,
    })),
    listUserTransactions: mock(async (_userId: number, limit: number) =>
      Array.from({ length: Math.min(limit, 2) }, (_, i) => ({
        id: i + 1,
        userId: 2,
        type: "income",
        status: "success",
        paymentStatus: "paid",
        amount: 55_000,
        capital: 51_780,
        description: "TOKEN 50K",
        category: null,
        date: "2026-10-10",
        createdAt: new Date("2026-10-10T09:00:00Z"),
      })),
    ),
  } satisfies AdminRepository;

  const mockUserService = {
    updateUserRole: mock(),
    deleteUser: mock(async () => true),
  } satisfies UserServiceCtx;

  let service: AdminService;

  beforeEach(() => {
    service = createAdminService({
      adminRepo: mockAdminRepo,
      userServiceLike: mockUserService,
    });
  });

  describe("users", () => {
    it("mengembalikan seluruh user beserta role-nya", async () => {
      const users = await service.users();

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.role)).toEqual(["admin", "user"]);
      expect(users.every((u) => !("password" in u))).toBe(true);
    });
  });

  describe("overview", () => {
    it("mengembalikan agregat lintas user", async () => {
      const overview = await service.overview();

      expect(overview.totalUsers).toBe(2);
      expect(overview.totalAdmins).toBe(1);
      expect(overview.totalTransactions).toBe(7);
    });
  });

  describe("userTransactions", () => {
    it("meneruskan userId dan limit ke repository", async () => {
      const rows = await service.userTransactions(ID.new(2), 10);

      expect(mockAdminRepo.listUserTransactions).toHaveBeenCalledWith(2, 10);
      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe(2);
    });

    it("memakai limit default saat tidak diisi", async () => {
      await service.userTransactions(ID.new(2));

      const limit = mockAdminRepo.listUserTransactions.mock.calls.at(-1)?.[1];
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(ADMIN_PAGE_MAX_LIMIT);
    });

    it("menolak limit bukan bilangan bulat positif", async () => {
      await expect(service.userTransactions(ID.new(2), 0)).rejects.toThrow(
        "limit must be a positive integer",
      );
      await expect(service.userTransactions(ID.new(2), 1.5)).rejects.toThrow(
        "limit must be a positive integer",
      );
    });

    it("menolak limit melebihi batas maksimum", async () => {
      await expect(service.userTransactions(ID.new(2), ADMIN_PAGE_MAX_LIMIT + 1)).rejects.toThrow(
        `limit must not exceed ${ADMIN_PAGE_MAX_LIMIT}`,
      );
    });
  });

  describe("setUserRole", () => {
    it("menolak admin mengubah role dirinya sendiri", async () => {
      await expect(service.setUserRole(ID.new(1), "user", ID.new(1))).rejects.toThrow(
        ValidationError,
      );
      expect(mockUserService.updateUserRole).not.toHaveBeenCalled();
    });

    it("meneruskan perubahan role untuk user lain", async () => {
      await service.setUserRole(ID.new(2), "admin", ID.new(1));

      expect(mockUserService.updateUserRole).toHaveBeenCalledWith(ID.new(2), "admin");
    });
  });

  describe("deleteUser", () => {
    it("menolak admin menghapus dirinya sendiri", async () => {
      await expect(service.deleteUser(ID.new(1), ID.new(1))).rejects.toThrow(
        "admin cannot delete their own account",
      );
      expect(mockUserService.deleteUser).not.toHaveBeenCalled();
    });

    it("menghapus user lain", async () => {
      expect(await service.deleteUser(ID.new(2), ID.new(1))).toBe(true);
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(ID.new(2));
    });
  });
});
