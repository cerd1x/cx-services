import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { ConflictError } from "$services/shared/kernel/errors/service-error";
import { createUserService, UserService } from "$services/domain/user";
import { User } from "$services/domain/user/adapters/driven/drizzle/user.entity";
import { ID } from "$services/shared/kernel/id";
describe("UserService", () => {
  const userRepo = {
    isWithUsername: mock(),
    isWithUserId: mock(),
    findById: mock(),
    save: mock(),
  } as any;

  beforeAll(() => {
    createUserService({ userRepo: userRepo as any });
  });

  afterEach(() => {
    for (const m of Object.values(userRepo)) (m as any).mockClear();
  });

  describe("create", () => {
    it("creates and saves a user", async () => {
      userRepo.isWithUsername.mockResolvedValue(false);
      userRepo.save.mockImplementation(async (u: User) => {
        u.id = ID.new(1);
        return u;
      });

      const result = await UserService.getInstance().createUser("Test", "testuser", "password123");

      expect(result.id?.toNumb).toBe(1);
      expect(result.username).toBe("testuser");
      expect(userRepo.save).toHaveBeenCalled();
    });

    it("throws ConflictError when username is taken", async () => {
      userRepo.isWithUsername.mockResolvedValue(true);

      await expect(
        UserService.getInstance().createUser("Test", "takenuser", "password123"),
      ).rejects.toThrow(ConflictError);
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("isUsernameTaken", () => {
    it("returns true when taken", async () => {
      userRepo.isWithUsername.mockResolvedValue(true);
      const result = await UserService.getInstance().isUsernameTaken("testuser");
      expect(result).toBe(true);
    });

    it("returns false when available", async () => {
      userRepo.isWithUsername.mockResolvedValue(false);
      const result = await UserService.getInstance().isUsernameTaken("newuser");
      expect(result).toBe(false);
    });
  });

  describe("isUserIdTaken", () => {
    it("returns true when taken", async () => {
      userRepo.isWithUserId.mockResolvedValue(true);
      const result = await UserService.getInstance().isUserIdTaken(ID.new(1));
      expect(result).toBe(true);
    });
  });
});
