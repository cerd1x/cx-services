import { beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setDB, setD1 } from "$services/shared/infra/db";
import { userTable } from "$services/shared/infra/db/drizzle-schema/user.schema";
import { createUserService, UserService } from "$services/domain/user";
import { createAssetService, AssetService } from "$services/domain/assets";
import { AssetRepositoryImpl } from "$services/domain/assets/adapters/driven/drizzle/asset.repository";
import { UnitOfWorkImpl } from "$services/domain/assets/adapters/driven/drizzle/uow.repository";
import { OutboxRepositoryImpl } from "$services/shared/infra/db/drizzle/outbox.repository";
import { UserRepositoryImpl } from "$services/domain/user/adapters/driven/drizzle/user.repository";
import { createAuthService, AuthService } from "$services/domain/auth";
import { AuthRepositoryImpl } from "$services/domain/auth/adapters/driven/drizzle/auth.repository";
import { createSettingService, SettingService } from "$services/domain/setting";
import { SettingRepositoryImpl } from "$services/domain/setting/adapters/driven/drizzle/setting.repository";
import { User } from "$services/domain/user/adapters/driven/drizzle/user.entity";

describe("User queries through services", () => {
  let sqlite: any;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    db = drizzle(env.d1 as any);
    setDB(db as any);
    setD1(env.d1 as any);

    createUserService({ userRepo: new UserRepositoryImpl() });
    // signUp membuat asset default, jadi service asset harus pakai repo sungguhan
    // (bukan sisa singleton dari file test lain).
    createAssetService({
      assetRepo: new AssetRepositoryImpl(),
      uow: new UnitOfWorkImpl(),
      outboxRepo: new OutboxRepositoryImpl(),
    });
    createSettingService({ settingRepo: new SettingRepositoryImpl() });
    createAuthService({
      userService: UserService.getInstance(),
      authRepo: new AuthRepositoryImpl(),
      settingService: SettingService.getInstance(),
    });
  });

  function close() {
    sqlite?.close();
  }

  it("users query returns a list (public name field)", async () => {
    const u = await UserService.getInstance().createUser(
      "Alice",
      "alice",
      "password123",
      "alice@test.com",
    );
    await UserService.getInstance().createUser("Bob", "bob", "password456", "bob@test.com");

    const all = await UserService.getInstance().users();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.some((user) => user.name === "Alice")).toBe(true);
    expect(all.some((user) => user.name === "Bob")).toBe(true);
  });

  it("createUser returns user with name and username", async () => {
    const user = await UserService.getInstance().createUser(
      "Charlie",
      "charlie",
      "pass789",
      "charlie@test.com",
    );

    expect(user.name).toBe("Charlie");
    expect(user.username).toBe("charlie");

    const all = await UserService.getInstance().users();
    const found = all.find((u) => u.username === "charlie");
    expect(found).toBeDefined();
    expect(found!.name).toBe("Charlie");
  });

  it("signUp returns session and refresh token", async () => {
    const uname = `signup_${Date.now()}`;
    const user = User.new({
      name: "SignUp User",
      username: uname,
      email: "signup@test.com",
      password: "test1234",
    });

    const result = await AuthService.getInstance().signUp(user);

    expect(result.user).toBeDefined();
    expect(result.user.name).toBe("SignUp User");
    expect(result.user.username).toBe(uname);
    expect(result.session).toBeDefined();
    expect(typeof result.session).toBe("string");
    expect(result.session.length).toBeGreaterThan(0);
    expect(result.refreshToken).toBeDefined();
    expect(typeof result.refreshToken).toBe("string");
  });
});
