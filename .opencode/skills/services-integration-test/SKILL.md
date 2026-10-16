---
name: services integration test
description: Panduan pembuatan integration test untuk services/* dengan **Hexagonal Architecture**, meliputi unit test (mocked repo) dan integration test (Elysia HTTP).
---

## Struktur Test

```
services/tests/
├── {domain}/
│   ├── {domain}_service.test.ts         # Unit test — mock repository
│   ├── {domain}_integration.test.ts     # Integration test — via Elysia HTTP
│   └── impl/
│       └── {domain}_service.test.ts     # Unit test dengan mock service lain
├── utils/
│   └── gql_integration_test.ts          # Utility: helper `gqlRequest`
```

## Runner & Imports

Gunakan `bun:test` — jangan `vitest` langsung:

```ts
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
```

## Path Aliases

| Alias                  | Target                       |
| ---------------------- | ---------------------------- |
| `$services`            | `./services`                 |
| `$services/*`          | `./services/*`               |
| `$gqlClientTypes`      | Generated GQL types (client) |
| `$gql/types.generated` | Generated GQL types (server) |

## Unit Test Pattern (Mock Repository)

### Struktur

1. Buat mock object untuk repository interface dengan `mock()`
2. Inisialisasi ulang service singleton dengan mock baru di `beforeEach`
3. `beforeEach` otomatis memberi mock fresh — tidak perlu cleanup manual
4. Panggil `Service.getInstance()` tanpa args di test

### Template

```ts
// services/tests/{domain}/{domain}_service.test.ts
import { describe, expect, it, beforeEach, mock } from "bun:test";
import { NotFoundError } from "$services/core/errors/service_error";
import { ServiceName } from "$services/core/{domain}/service/{domain}_service";
import { ID } from "$services/utils/id";

describe("ServiceName", () => {
  let repo: { methodName: ReturnType<typeof mock> };

  beforeEach(() => {
    repo = { methodName: mock() };
    ServiceName.getInstance(repo);
  });

  describe("methodName", () => {
    it("returns result on success", async () => {
      repo.methodName.mockResolvedValue({ id: 1, name: "Test" });

      const result = await ServiceName.getInstance().methodName(input);

      expect(result.id).toBe(1);
      expect(repo.methodName).toHaveBeenCalledWith(expect.objectContaining({ name: "Test" }));
    });

    it("throws when not found", async () => {
      repo.methodName.mockResolvedValue(null);

      await expect(ServiceName.getInstance().methodName(badInput)).rejects.toThrow(NotFoundError);
      expect(repo.methodName).toHaveBeenCalled();
    });
  });
});
```

### Aturan Unit Test

| Aturan                                | Keterangan                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Mock repository interface**         | Buat object dengan `mock()` untuk tiap method repositori                                                   |
| **Init di `beforeEach`**              | `Service.getInstance(mockedRepo)` ulang tiap test agar mock selalu fresh                                   |
| **No manual cleanup**                 | `beforeEach` otomatis bikin mock baru — tidak perlu `afterEach` untuk cleanup                              |
| **Akses service via `getInstance()`** | Panggil tanpa argumen — instance sudah di-init di beforeEach                                               |
| **Error domain**                      | Gunakan `NotFoundError`, `ConflictError`, `AuthenticationError` dari `$services/core/errors/service_error` |
| **Type mock dengan `satisfies`**      | Gunakan `satisfies RepositoryInterface` untuk type safety                                                  |

### Test untuk Service dengan Multi-Dependency

Untuk service seperti `AuthService` yang dependen pada service lain dan repository:

```ts
// services/tests/auth/impl/auth_service.test.ts
import { describe, expect, it, beforeEach, mock } from "bun:test";
import { AuthService, UserServiceLike } from "$services/core/auth/service/auth_service";
import { User } from "$services/core/user/entities/user_entities";
import { ID } from "$services/utils";

describe("AuthService", () => {
  let userService: Record<string, ReturnType<typeof mock>>;
  let authRepo: Record<string, ReturnType<typeof mock>>;

  beforeEach(() => {
    userService = {
      createUser: mock(),
      userByUsername: mock(),
      user: mock(),
    };
    authRepo = {
      saveToken: mock(),
      findToken: mock(),
      deleteToken: mock(),
    };
    AuthService.getInstance(userService as unknown as UserServiceLike, authRepo);
  });

  it("returns session on signUp", async () => {
    const savedUser = User.new({ name: "Test", username: "testuser", password: "pass" });
    savedUser.id = ID.new(1);
    userService.createUser.mockResolvedValue(savedUser);
    authRepo.saveToken.mockResolvedValue({
      session: "mock-session",
      refreshToken: "mock-refresh",
    });

    const result = await AuthService.getInstance().signUp(savedUser);

    expect(result.session).toBe("mock-session");
    expect(userService.createUser).toHaveBeenCalled();
  });
});
```

## Integration Test Pattern (Elysia HTTP)

### Struktur

1. Import `app` dari `$services/index` — instance Elysia
2. Gunakan `app.fetch()` untuk kirim HTTP request ke GraphQL endpoint
3. Atau gunakan utility `gqlRequest()` untuk lebih ringkas
4. Handle cookie auth untuk mutation yang butuh session
5. Cleanup data di `afterAll`

### Template Dasar

```ts
// services/tests/{domain}/{domain}_integration.test.ts
import { afterAll, describe, expect, it } from "bun:test";
import app from "$services/index";

async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  const res = await app.fetch(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ query, variables }),
    }),
  );
  const body = await res.json();
  if (body.errors) throw new Error(body.errors.map((e: any) => e.message).join(", "));
  return body.data as T;
}

describe("{Domain} integration", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      try {
        await gql(`mutation { delete{Domain}(id: "${id}") }`);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it("creates {domain}", async () => {
    const data = await gql<{ create{Domain}: { id: string } }>(
      `mutation($input: Create{Domain}Input!) {
        create{Domain}(input: $input) { id }
      }`,
      { input: { /* ... */ } },
    );

    expect(data.create{Domain}.id).toBeDefined();
    createdIds.push(data.create{Domain}.id);
  });

  it("returns all {domain}s", async () => {
    const data = await gql<{ {domain}s: { id: string }[] }>(
      `{ {domain}s { id } }`,
    );

    expect(Array.isArray(data.{domain}s)).toBe(true);
  });
});
```

### Auth — Sign Up & Cookie Test

Untuk test endpoint yang butuh autentikasi:

```ts
function getSetCookies(res: Response): string[] {
  if (typeof (res.headers as any).getSetCookie === "function") {
    return (res.headers as any).getSetCookie();
  }
  const header = res.headers.get("set-cookie");
  return header ? [header] : [];
}

it("signs up and sets cookies", async () => {
  const res = await app.fetch(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `mutation($input: SignUpInput!) {
          signUp(input: $input) { session refreshToken }
        }`,
        variables: {
          input: { name: "User", username: `test_${Date.now()}`, password: "pass1234" },
        },
      }),
    }),
  );

  const body = await res.json();
  expect(body.data.signUp.session).toBeDefined();

  const setCookie = getSetCookies(res);
  const sessionCookie = setCookie.find((c) => c.startsWith("__sst__="));
  expect(sessionCookie).toBeDefined();
});
```

### Auth — Query with Token

Untuk query butuh token (dapat dari signUp):

```ts
it("queries with auth token", async () => {
  // 1. Sign up to get token
  const signUpRes = await app.fetch(/* signUp mutation */);
  const signUpBody = await signUpRes.json();
  const token = signUpBody.data.signUp.session;

  // 2. Use token in Authorization header
  const res = await app.fetch(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: "{ users { name username } }" }),
    }),
  );

  const body = await res.json();
  expect(body.errors).toBeUndefined();
  expect(body.data.users.length).toBeGreaterThanOrEqual(1);
});
```

### Utility `gqlRequest`

Project menyediakan utility di `services/tests/utils/gql_integration_test.ts`:

```ts
import { gqlRequest } from "../utils/gql_integration_test";
import { YourDocument, YourQuery } from "$gqlClientTypes";

it("query with gqlRequest", async () => {
  const { data, req } = await gqlRequest<YourQuery>(YourDocument);
  expect(data.yourField).toBeDefined();
});
```

### Aturan Integration Test

| Aturan                       | Keterangan                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------- |
| **Gunakan `app.fetch()`**    | Import `app` dari `$services/index` — request langsung ke Elysia tanpa HTTP riil |
| **GraphQL endpoint**         | `POST http://localhost/graphql`                                                  |
| **Cleanup data**             | Simpan `id` hasil create di array, hapus di `afterAll`                           |
| **Unique test data**         | Gunakan `Date.now()` untuk username/name yang unik                               |
| **Error handling**           | Cek `body.errors` dari response, reject dengan error message                     |
| **Cookie test**              | Pakai `getSetCookies()` helper, test `__sst__=` dan `__rft__=` cookies           |
| **Auth token**               | SignUp dulu untuk dapat session token, kirim via `authorization: Bearer`         |
| **Separate describe blocks** | Kelompokkan test per use case (create, query, auth, cleanup)                     |

## Error Assertions

| Error                    | Import                                  |
| ------------------------ | --------------------------------------- |
| `NotFoundError`          | `$services/core/errors/service_error`   |
| `ConflictError`          | `$services/core/errors/service_error`   |
| `AuthenticationError`    | `$services/core/errors/service_error`   |
| `ValidationError`        | `$services/core/errors/service_error`   |
| Generic error by message | `rejects.toThrow("message substring")`  |
| GraphQL error            | Check `body.errors` array from response |
