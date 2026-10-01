## Auth Module — Penjelasan & Alur Kerja [L1-296]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **autentikasi** dan **otorisasi** user dalam sistem. Module ini bertanggung jawab atas proses signup, signin, signout, manajemen token session/refresh, dan verifikasi otentikasi pengguna.

---

### Struktur Direktori & File [L9-37]

```text
domain/auth/
├── core/
│   ├── model/
│   │   └── index.ts
│   ├── ports/
│   │   └── out/
│   │       ├── auth-repository.port.ts
│   │       └── passkey-repository.port.ts
│   ├── types/
│   │   └── user-service-like.ts
│   ├── usecase/
│   │   ├── authorize.usecase.ts
│   │   ├── ctx.ts
│   │   ├── delete-passkey.usecase.ts
│   │   ├── issue-session.usecase.ts
│   │   ├── list-passkeys.usecase.ts
│   │   ├── passkey-authentication-options.usecase.ts
│   │   ├── passkey-delete.usecase.ts
│   │   ├── passkey-find-by-user-id.usecase.ts
│   │   ├── passkey-generate-authentication-options.usecase.ts
│   │   ├── passkey-generate-registration-options.usecase.ts
│   │   ├── passkey-register.usecase.ts
│   │   ├── passkey-registration-options.usecase.ts
│   │   ├── passkey-verify-authentication.usecase.ts
│   │   ├── register-passkey.usecase.ts
│   │   ├── sign-in-with-passkey.usecase.ts
│   │   ├── sign-in.usecase.ts
│   │   ├── sign-out.usecase.ts
│   │   └── sign-up.usecase.ts
│   └── value-objects/
│       ├── logger.ts
│       ├── token.vo.ts
│       └── webauthn.vo.ts
├── adapters/
│   ├── driven/
│   │   └── drizzle/
│   │       ├── auth.repository.ts
│   │       └── passkey.repository.ts
│   └── driving/
│       └── graphql/
│           ├── auth.gql
│           └── auth.resolver.ts
├── auth.composition.ts
└── index.ts
```

---

### Penjelasan File Per-File [L38-139]

#### 1. `core/value-objects/token.vo.ts` [L40-65]

[`services/domain/auth/core/value-objects/token.vo.ts`](./core/value-objects/token.vo.ts)

- **`tokenSchema`** — Zod schema (`z.object({...})`)
  - **Fields:**
    1. `userId`: `z.number().positive()` — required, user ID
    2. `expiresAt`: `z.date()` — required, token expiry
    3. `type`: `z.enum(["session", "refresh"]).default("session")` — required
- **`TokenInput`** — `z.input<typeof tokenSchema>`
- **`TokenPayload`** — `z.output<typeof tokenSchema>`
- **`TokenData`** — Alias untuk `TokenPayload`
- **`TokenType`** — `"session" | "refresh"`
- **`Token` class** — Value object untuk manajemen JWT token dengan method:
  - **Static:** `defaultExpireAt` — Default 24 jam dalam milliseconds
  - **Static:** `setDefaultExpireAt(ms)` — Override default expiry
  - **`create(input)`** — Buat token baru dengan expiry default, validasi Zod
  - **`generate()`** — Generate JWT string menggunakan `jsonwebtoken`
  - **`verify(token)`** — Verifikasi dan decode token, return payload
  - **`decode(token)`** — Decode token tanpa verifikasi, return payload atau null
  - **`from(token)`** — Buat Token instance dari string JWT, throw jika invalid
  - **`isExpired()`** — Cek apakah token sudah expired
  - **`setType(type)`** — Set tipe token (session/refresh), return `this`
  - **`setExpireAt(expire)`** — Set expiry time, return `this`
  - **Getters:** `userId`, `expiresAt`, `type`, `metadata`

#### 2. `core/value-objects/logger.ts` [L66-69]

- Membuat instance logger khusus untuk `AuthService` dengan prefix `"AuthService"` dan file log `auth-service-log.log`

#### 3. `core/ports/out/auth-repository.port.ts` [L70-82]

[`services/domain/auth/core/ports/out/auth-repository.port.ts`](./core/ports/out/auth-repository.port.ts)

- **`TokenRecord` type** — Record dasar untuk token: `userId`, `expiredAtSession`, `expiredAtRefresh`
- **Abstract class `AuthRepository`** — Port (out) yang mendefinisikan kontrak repository token sesi. AuthService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/auth.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter).

  **Daftar Method:**

  1. **`saveToken(userId, data)`** — Simpan pasangan session + refresh token ke DB
     - Parameter:
       - `userId: number` — pemilik token
       - `data: { sessionToken, refreshToken, expiredAtSession, expiredAtRefresh }` — nilai token + kedaluwarsa masing-masing
     - Return: `Promise<TokenRecord & { session, refreshToken }>` — record tersimpan beserta nilai token

  2. **`findToken(token)`** — Cari record token by nilai token
     - Parameter:
       - `token: string` — session/refresh token yang dicari
     - Return: `Promise<(TokenRecord & { session: string | null; refreshToken: string | null }) | null>` — record jika ditemukan (nilai token bisa `null`), `null` jika tidak ada

  3. **`findTokensByUserId(userId)`** — Cari record token milik user
     - Parameter:
       - `userId: number`
     - Return: `Promise<(TokenRecord & { session: string | null; refreshToken: string | null }) | null>` — sama seperti `findToken`

  4. **`updateToken(userId, data)`** — Update record token user
     - Parameter:
       - `userId: number` — pemilik token
       - `data: Partial<TokenRecord & { session?, refresh? }>` — field yang mau diupdate (partial)
     - Return: `Promise<TokenRecord>` — record hasil update

  5. **`deleteToken(token)`** — Hapus satu record token by nilai token
     - Parameter:
       - `token: string`
     - Return: `Promise<void>` — tidak mengembalikan apa pun

  6. **`deleteExpiredTokens()`** — Hapus semua token yang sudah expired (cleanup)
     - Parameter: tidak ada
     - Return: `Promise<number>` — jumlah baris token yang terhapus

#### 4. `core/usecase/auth_service.ts` [L83-98]

[`services/domain/auth/app/use-cases/auth_service.ts`](./app/use-cases/auth_service.ts)

- **Singleton pattern** — `AuthService.getInstance()`
- **Interface `UserServiceLike`** — Abstraction untuk menghubungkan dengan UserService:
  - `createUser(name, username, password)` — Buat user baru
  - `userByUsername(username)` — Cari user by username
  - `user(id)` — Cari user by ID
  - `deleteUser(userId)` — Hapus user
- **Use cases:**
  - `signUp(user)` — Daftar user baru, buat asset default, setting default, dan token
  - `signIn(username, password)` — Login user, verifikasi password, generate/renew token
  - `signOut(sessionToken, refreshToken?)` — Logout user, hapus token
  - `authorize(token)` — Verifikasi token, return user + token info

#### 5. `adapters/driven/drizzle/auth.repository.ts` [L99-107]

[`services/domain/auth/adapters/driven/drizzle/auth.repository.ts`](./adapters/driven/drizzle/auth.repository.ts)

- Implementasi `AuthRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Operasi token: `saveToken`, `findToken`, `findTokensByUserId`, `updateToken`, `deleteToken`, `deleteExpiredTokens`
- Menggunakan `getD1()` untuk raw query dan `getDB()` untuk Drizzle ORM
- Mendukung fallback dari raw D1 query ke Drizzle ORM

#### 6. `adapters/driving/graphql/auth.gql` [L108-113]

- **Query**: `me` — ambil data user yang login, `checkAuthorized(session)` — cek apakah session valid
- **Mutation**: `signUp(input)`, `signIn(input)`, `signOut(input)`
- Semua query/mutation publik (tanpa `@authorized` untuk signup/signin/checkAuthorized)

#### 7. `adapters/driving/graphql/auth.resolver.ts` [L114-124]

[`services/domain/auth/adapters/driving/graphql/auth.resolver.ts`](./adapters/driving/graphql/auth.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `AuthService`
- `signUp` — buat User entity, panggil `auth.signUp()`, set cookie session + refresh token
- `signIn` — panggil `auth.signIn()`, set cookie session + refresh token
- `signOut` — panggil `auth.signOut()`, hapus cookie
- `me` — return data user yang sedang login
- `checkAuthorized` — verifikasi session dan refresh cookie jika session baru

#### 8. `auth.composition.ts` [L125-131]

[`services/domain/auth/auth.composition.ts`](./auth.composition.ts)

- **Wiring**: Inisialisasi `AuthRepositoryImpl` + `AuthService.getInstance()` dengan dependency `UserService`, `AuthRepositoryImpl`, dan `SettingService`
- Export singleton `authService` yang digunakan module lain

#### 9. `index.ts` [L132-139]

[`services/domain/auth/index.ts`](./index.ts)

- Export `authService` untuk digunakan module lain

---

### Use Cases [L140-222]

#### `signUp(user)` — Daftar user baru [L142-164]

[`services/domain/auth/app/use-cases/auth_service.ts`](./app/use-cases/auth_service.ts)(line 55:94)

```ts
async signUp(user: User): Promise<{ user: User; session: string; refreshToken: string }>
```

    > `userService.createUser(user.name, user.username, user.password)`
    >
    > > `user.id` undefined → `AuthenticationError` ("userId is required")
    > > `user.id` defined → try block
    > > `AssetService.getInstance().createAsset()` — buat asset "MyCash" (cash, IDR 0)
    > > `settingService.createDefaultSettings()` — buat setting default
    > > `catch` → `userService.deleteUser(user.id)` → rethrow error
    > > `Token.create({ userId: user.id.toNumb })` — buat token
    > > `token.setType("session").generate()` — generate session token
    > > `token.setType("refresh").setExpireAt(...).generate()` — generate refresh token
    > > `authRepo.saveToken()` — simpan token ke DB
    > > `return { user, session, refreshToken }`

---

#### `signIn(username, password)` — Login user [L165-185]

[`services/domain/auth/app/use-cases/auth_service.ts`](./app/use-cases/auth_service.ts)(line 97:174)

```ts
async signIn(username: string, password: string): Promise<{ user: User; session: string; refreshToken: string }>
```

    > `userService.userByUsername(username)`
    >
    > > `PasswordUtils.verify(password, user.password)`
    > > `false` → `AuthenticationError` ("Invalid password")
    > > `true` → `user.id` undefined → `AuthenticationError` ("userId is required")
    > > `authRepo.findTokensByUserId(user.id.toNumb)`
    > > `existing` null → buat token baru → `authRepo.saveToken()` → return
    > > `existing` ada + `refreshToken` valid + session expired → generate session baru → `authRepo.updateToken()` → return
    > > `existing` ada + `refreshToken` valid + session valid → return existing tokens
    > > `existing` ada + `refreshToken` invalid/expired → buat token baru → return

---

#### `signOut(sessionToken, refreshToken?)` — Logout user [L186-200]

[`services/domain/auth/app/use-cases/auth_service.ts`](./app/use-cases/auth_service.ts)(line 177:182)

```ts
async signOut(sessionToken: string, refreshToken?: string): Promise<void>
```

    > `authRepo.deleteToken(sessionToken)`
    >
    > > `refreshToken` ada → `authRepo.deleteToken(refreshToken)`
    > > `return void`

---

#### `authorize(token)` — Verifikasi token dan return user [L201-222]

[`services/domain/auth/app/use-cases/auth_service.ts`](./app/use-cases/auth_service.ts)(line 185:239)

```ts
async authorize(token: string): Promise<{ user: User; token: { session: string | null; refresh: string | null } | null }>
```

    > `token.length === 0` → `AuthenticationError` ("Token is required")
    > `authRepo.findToken(token)`
    >
    > > `null` → `AuthenticationError` ("Invalid token")
    > > data ditemukan
    > > `Date.now() >= expiredAtSession`
    > > `refreshToken` null → `UnauthorizedError` ("token expired, please sign-in again")
    > > `Token.from(refreshToken).isExpired()` → `true` → `UnauthorizedError` ("token expired, please sign-in again")
    > > `false` → generate session baru → `authRepo.updateToken()` → return user + new session
    > > session valid → `userService.user(ID.new(data.userId))` → return user + null token
    > > `catch` → `UnauthorizedError` ("Token Invalid")

---

### Alur Kerja (Data Flow) [L223-261]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (auth.gql → auth.resolver.ts)                                │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Resolver panggil AuthService (use case layer)                 │
│    auth.resolver.ts → auth_service.ts                            │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. AuthService jalankan business logic:                         │
│    - signUp: buat user via UserService                           │
│    - signIn: verifikasi password via UserService                 │
│    - authorize: verifikasi token via AuthRepository              │
│    - Manajemen session/refresh token                             │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. AuthRepositoryImpl (driven adapter) eksekusi DB query         │
│    - Simpan/cari token di tabel token                            │
│    - Drizzle ORM → SQLite D1                                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Response balik via resolver → GraphQL client                 │
│    - Set cookie session + refresh token                          │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain (Signup Flow) [L262-288]

Auth module adalah **entry point** untuk autentikasi. Berikut alurnya:

```text
signUp mutation (auth.resolver.ts)
    │
    ▼
AuthService.signUp()
    │
    ├──► UserService.createUser()          ← Module USER
    │       └──→ buat user baru + hash password
    │
    ├──► AssetService.createAsset()        ← Module ASSET
    │       └──→ buat "MyCash" (cash, IDR 0)
    │
    ├──► SettingService.createDefaultSettings()  ← Module SETTING
    │       └──→ buat setting default (IDR, darkMode=false)
    │
    └──→► AuthRepository.saveToken()        ← Module AUTH
            └──→ session + refresh token
```

**Penting**: Jika pembuatan asset/setting gagal saat signup, user yang baru dibuat akan **dihapus** (`deleteUser`) untuk konsistensi data.

---

### Catatan Arsitektur [L289-296]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `auth.composition.ts` — singleton diinisialisasi saat app startup
- **JWT-based Auth**: Menggunakan `jsonwebtoken` untuk generate dan verify token
- **Cross-module dependency**: Bergantung pada `UserServiceLike` (interface), `SettingService`, dan `AssetService`
- **Cookie-based Session**: Session dan refresh token disimpan di cookie client
- **WebAuthn Passkey**: Sign-in biometrik lewat passkey — lihat [`auth.passkey.md`](./auth.passkey.md)
