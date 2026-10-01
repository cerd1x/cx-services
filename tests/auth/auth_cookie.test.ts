import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { User } from "$services/domain/user/adapters/driven/drizzle/user.entity";
import { createUserService, UserService } from "$services/domain/user";
import { createAuthService, AuthService } from "$services/domain/auth";
import { AssetService } from "$services/domain/assets";
import type { Asset } from "$services/domain/assets/adapters/driven/drizzle/asset.entity";
import { ID } from "$services/shared/kernel";
import type { UserRepository } from "$services/domain/user/core/ports/out/user-repository.port";

describe("signUp with mocked UserRepository + AuthRepository", () => {
  const mockUserRepo = {
    isWithUsername: mock(),
    isWithUserId: mock(),
    findByUsername: mock(),
    findById: mock(),
    findAll: mock(),
    save: mock(),
    update: mock(),
    delete: mock(),
  } satisfies UserRepository;

  const mockUserService = {
    createUser: mock(),
    findByUsername: mock(),
    findById: mock(),
    isUsernameTaken: mock(),
    isUserIdTaken: mock(),
    deleteUser: mock(),
  };

  const mockAuthRepo = {
    saveToken: mock(),
    findToken: mock(),
    findTokensByUserId: mock(),
    updateToken: mock(),
    deleteToken: mock(),
    deleteExpiredTokens: mock(),
  };

  const mockSettingService = {
    createDefaultSettings: mock(),
  };

  const mockAssetService = () => ({
    createAsset: mock().mockResolvedValue({} as Asset),
    deleteAsset: mock().mockResolvedValue(undefined),
    createDefaultAssetCash: mock().mockResolvedValue({} as Asset),
  });

  const assetSpy = spyOn(AssetService, "getInstance");

  beforeAll(() => {
    assetSpy.mockReturnValue(mockAssetService() as any);
    createUserService({ userRepo: mockUserRepo as any });
    createAuthService({
      userService: mockUserService as any,
      authRepo: mockAuthRepo as any,
      settingService: mockSettingService as any,
    });
  });

  beforeEach(() => {
    assetSpy.mockReturnValue(mockAssetService() as any);
  });

  afterEach(() => {
    for (const m of [
      ...Object.values(mockUserRepo),
      ...Object.values(mockUserService),
      ...Object.values(mockAuthRepo),
      ...Object.values(mockSettingService),
    ])
      (m as any).mockClear();
  });

  afterAll(() => {
    assetSpy.mockRestore();
  });

  it("returns session + refreshToken", async () => {
    const savedUser = User.new({
      name: "Test User",
      username: "testuser",
      email: "",
      password: "test1234",
    });
    savedUser.id = ID.new(1);

    mockUserService.createUser.mockResolvedValue(savedUser);
    mockAuthRepo.saveToken.mockResolvedValue({
      session: "mock-session",
      refreshToken: "mock-refresh",
    });

    const user = User.new({
      name: "Test User",
      username: "testuser",
      email: "",
      password: "test1234",
    });
    const result = await AuthService.getInstance().signUp(user);

    expect(result.session).toBe("mock-session");
    expect(result.refreshToken).toBe("mock-refresh");
    expect(mockUserService.createUser).toHaveBeenCalledWith("Test User", "testuser", "test1234");
  });

  it("throws when saved user has no id", async () => {
    mockUserService.createUser.mockResolvedValue(
      User.new({
        name: "No ID User",
        username: "noid",
        email: "",
        password: "test1234",
      }),
    );

    const user = User.new({
      name: "No ID User",
      username: "noid",
      email: "",
      password: "test1234",
    });

    await expect(AuthService.getInstance().signUp(user)).rejects.toThrow("userId is required");
  });
});
