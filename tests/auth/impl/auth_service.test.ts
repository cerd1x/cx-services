import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { User } from "$services/domain/user/core/entity/user.entity";
import { createAuthService, AuthService, type UserServiceLike } from "$services/domain/auth";
import { AssetService } from "$services/domain/assets";
import type { Asset } from "$services/domain/assets/core/entity/asset.entity";
import { Token } from "$services/domain/auth/core/value-objects/token.vo";
import {
  AuthenticationError,
  UnauthorizedError,
} from "$services/shared/kernel/errors/service-error";
import { ID } from "$services/shared/kernel";
import { PasswordUtils } from "$services/shared/kernel/password-utils";

describe("AuthService", () => {
  const userService: Record<string, ReturnType<typeof mock>> = {
    createUser: mock(),
    user: mock(),
    userByUsername: mock(),
    isUsernameTaken: mock(),
    isUserIdTaken: mock(),
    deleteUser: mock(),
  };

  const authRepo = {
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

  const mockPasskeyService = {
    verifyAuthentication: mock(),
    generateRegistrationOptions: mock(),
    generateAuthenticationOptions: mock(),
    register: mock(),
    findByUserId: mock(),
    delete: mock(),
  };

  beforeAll(() => {
    createAuthService({
      userService: userService as any as UserServiceLike,
      authRepo,
      settingService: mockSettingService as any,
      passkeyService: mockPasskeyService as any,
    });
  });

  const mockAssetService = () => ({
    createAsset: mock().mockResolvedValue({} as Asset),
    deleteAsset: mock().mockResolvedValue(undefined),
    createDefaultAssetCash: mock().mockResolvedValue({} as Asset),
  });

  const assetSpy = spyOn(AssetService, "getInstance");

  beforeEach(() => {
    assetSpy.mockReturnValue(mockAssetService() as any);
  });

  afterEach(() => {
    for (const m of [
      ...Object.values(userService),
      ...Object.values(authRepo),
      ...Object.values(mockSettingService),
      ...Object.values(mockPasskeyService),
    ])
      (m as any).mockClear();
  });

  afterAll(() => {
    assetSpy.mockRestore();
  });

  describe("signUp", () => {
    it("returns user, session and refreshToken on success", async () => {
      const savedUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });
      savedUser.id = ID.new(1);
      userService.createUser.mockResolvedValue(savedUser);

      authRepo.saveToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() + 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "mock-session-token",
        refreshToken: "mock-refresh-token",
      });

      spyOn(Token.prototype, "generate").mockReturnValue("mock-token");

      const user = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });
      const result = await AuthService.getInstance().signUp(user);

      expect(result.user.id?.toNumb).toBe(1);
      expect(result.session).toBe("mock-session-token");
      expect(result.refreshToken).toBe("mock-refresh-token");

      expect(userService.createUser).toHaveBeenCalledWith("Test", "testuser", "password123");

      expect(authRepo.saveToken).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          sessionToken: "mock-token",
          refreshToken: "mock-token",
          expiredAtSession: expect.any(Date),
          expiredAtRefresh: expect.any(Date),
        }),
      );
    });

    it("propagates error from UserService.create", async () => {
      userService.createUser.mockRejectedValue(new Error("username taken"));

      const user = User.new({
        name: "Test",
        username: "takenuser",
        email: "taken@test.com",
        password: "password123",
      });

      await expect(AuthService.getInstance().signUp(user)).rejects.toThrow("username taken");
      expect(authRepo.saveToken).not.toHaveBeenCalled();
    });

    it("throws when saved user has no id", async () => {
      userService.createUser.mockResolvedValue(
        User.new({
          name: "Test",
          username: "testuser",
          email: "test@test.com",
          password: "password123",
        }),
      );

      const user = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });

      await expect(AuthService.getInstance().signUp(user)).rejects.toThrow("userId is required");
    });
  });

  describe("signIn", () => {
    beforeEach(() => {
      spyOn(PasswordUtils, "verify").mockImplementation(
        async (password: string, _hash: string) => password === "password123",
      );
    });

    it("returns user, session and refreshToken on valid credentials", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });
      foundUser.id = ID.new(1);
      userService.userByUsername.mockResolvedValue(foundUser);

      authRepo.saveToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() + 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "mock-session-token",
        refreshToken: "mock-refresh-token",
      });

      spyOn(Token.prototype, "generate").mockReturnValue("mock-token");

      const result = await AuthService.getInstance().signIn("testuser", "password123");

      expect(result.user.id?.toNumb).toBe(1);
      expect(result.session).toBe("mock-token");
      expect(result.refreshToken).toBe("mock-token");
      expect(userService.userByUsername).toHaveBeenCalledWith("testuser");
    });

    it("throws on wrong password", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "correct-password",
      });
      foundUser.id = ID.new(1);
      userService.userByUsername.mockResolvedValue(foundUser);

      await expect(AuthService.getInstance().signIn("testuser", "wrong-password")).rejects.toThrow(
        "Invalid password",
      );
    });

    it("throws when user has no id", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });
      userService.userByUsername.mockResolvedValue(foundUser);

      await expect(AuthService.getInstance().signIn("testuser", "password123")).rejects.toThrow(
        "userId is required",
      );
    });
  });

  describe("signInWithPassKey", () => {
    it("returns user, session and refreshToken on valid assertion", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });
      foundUser.id = ID.new(1);

      mockPasskeyService.verifyAuthentication.mockResolvedValue({ userId: 1 });
      userService.user.mockResolvedValue(foundUser);
      authRepo.saveToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() + 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "mock-session-token",
        refreshToken: "mock-refresh-token",
      });
      spyOn(Token.prototype, "generate").mockReturnValue("mock-token");

      const result = await AuthService.getInstance().signInWithPassKey({
        challenge: "challenge-token",
        credentialId: "cred-id",
        assertionResponse: {} as any,
        origin: "https://example.com",
        rpID: "example.com",
      });

      expect(result.user.id?.toNumb).toBe(1);
      expect(result.session).toBe("mock-token");
      expect(result.refreshToken).toBe("mock-token");
      expect(mockPasskeyService.verifyAuthentication).toHaveBeenCalledWith({
        challenge: "challenge-token",
        credentialId: "cred-id",
        assertionResponse: {},
        origin: "https://example.com",
        rpID: "example.com",
      });
      expect(userService.user).toHaveBeenCalledWith(ID.new(1));
    });

    it("reuses existing valid session instead of creating a new token", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "password123",
      });
      foundUser.id = ID.new(1);

      mockPasskeyService.verifyAuthentication.mockResolvedValue({ userId: 1 });
      userService.user.mockResolvedValue(foundUser);
      authRepo.findTokensByUserId.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() + 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "existing-session",
        refreshToken: "existing-refresh",
      });

      const result = await AuthService.getInstance().signInWithPassKey({
        challenge: "challenge-token",
        credentialId: "cred-id",
        assertionResponse: {} as any,
        origin: "https://example.com",
        rpID: "example.com",
      });

      expect(result.session).toBe("existing-session");
      expect(result.refreshToken).toBe("existing-refresh");
      expect(authRepo.saveToken).not.toHaveBeenCalled();
    });

    it("throws when passkey verification fails", async () => {
      mockPasskeyService.verifyAuthentication.mockRejectedValue(
        new AuthenticationError("Passkey not found"),
      );

      await expect(
        AuthService.getInstance().signInWithPassKey({
          challenge: "challenge-token",
          credentialId: "missing-cred",
          assertionResponse: {} as any,
          origin: "https://example.com",
          rpID: "example.com",
        }),
      ).rejects.toThrow("Passkey not found");

      expect(authRepo.saveToken).not.toHaveBeenCalled();
    });
  });

  describe("signOut", () => {
    it("deletes the session token", async () => {
      authRepo.deleteToken.mockResolvedValue(undefined);

      await AuthService.getInstance().signOut("session-token");

      expect(authRepo.deleteToken).toHaveBeenCalledWith("session-token");
    });

    it("deletes refresh token when provided", async () => {
      authRepo.deleteToken.mockResolvedValue(undefined);

      await AuthService.getInstance().signOut("session-token", "refresh-token");

      expect(authRepo.deleteToken).toHaveBeenCalledWith("session-token");
      expect(authRepo.deleteToken).toHaveBeenCalledWith("refresh-token");
    });
  });

  describe("authorize", () => {
    it("returns user and token null on valid session", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "pass",
      });
      foundUser.id = ID.new(1);

      authRepo.findToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() + 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "valid-session-token",
        refreshToken: null,
      });
      userService.user.mockResolvedValue(foundUser);

      const result = await AuthService.getInstance().authorize("valid-session-token");

      expect(result.user.id?.toNumb).toBe(1);
      expect(result.token).toBeNull();
      expect(authRepo.findToken).toHaveBeenCalledWith("valid-session-token");
    });

    it("throws AuthenticationError on empty token", async () => {
      await expect(AuthService.getInstance().authorize("")).rejects.toThrow(AuthenticationError);
      expect(authRepo.findToken).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError on token not found", async () => {
      authRepo.findToken.mockResolvedValue(null);

      await expect(AuthService.getInstance().authorize("invalid-token")).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("returns new session token when session expired and refresh token valid", async () => {
      const foundUser = User.new({
        name: "Test",
        username: "testuser",
        email: "test@test.com",
        password: "pass",
      });
      foundUser.id = ID.new(1);

      authRepo.findToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() - 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "expired-session-token",
        refreshToken: "valid-refresh-token",
      });

      const mockRefreshToken = {
        isExpired: mock(() => false),
      };

      const mockSessionToken = {
        userId: 1,
        setExpireAt: mock(() => mockSessionToken),
        setType: mock(() => mockSessionToken),
        generate: mock(() => "new-session-token"),
      };

      const fromSpy = spyOn(Token, "from");
      fromSpy.mockImplementationOnce(() => mockRefreshToken as unknown as Token);
      fromSpy.mockImplementationOnce(() => mockSessionToken as unknown as Token);

      userService.user.mockResolvedValue(foundUser);
      authRepo.updateToken.mockResolvedValue({} as any);

      const result = await AuthService.getInstance().authorize("expired-session-token");

      expect(result.user.id?.toNumb).toBe(1);
      expect(result.token?.session).toBe("new-session-token");
      expect(result.token?.refresh).toBeNull();
      expect(authRepo.updateToken).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          session: "new-session-token",
          expiredAtSession: expect.any(Date),
        }),
      );
    });

    it("throws UnauthorizedError when session expired and no refresh token", async () => {
      authRepo.findToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() - 86_400_000),
        expiredAtRefresh: new Date(Date.now() + 86_400_000 * 7),
        session: "expired-session-token",
        refreshToken: null,
      });

      await expect(AuthService.getInstance().authorize("expired-session-token")).rejects.toThrow(
        UnauthorizedError,
      );
      expect(authRepo.updateToken).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError when refresh token is also expired", async () => {
      authRepo.findToken.mockResolvedValue({
        userId: 1,
        expiredAtSession: new Date(Date.now() - 86_400_000),
        expiredAtRefresh: new Date(Date.now() - 86_400_000),
        session: "expired-session-token",
        refreshToken: "expired-refresh-token",
      });

      const mockRefreshToken = {
        isExpired: mock(() => true),
      };

      spyOn(Token, "from").mockImplementationOnce(() => mockRefreshToken as unknown as Token);

      await expect(AuthService.getInstance().authorize("expired-session-token")).rejects.toThrow(
        UnauthorizedError,
      );
      expect(authRepo.updateToken).not.toHaveBeenCalled();
    });
  });
});
