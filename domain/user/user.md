## User Module — Penjelasan & Alur Kerja [L1-355]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **user** dan **management** user dalam sistem. Module ini bertanggung jawab atas CRUD user, validasi data user, dan menjadi pusat integrasi saat proses **signup** (di mana user creation memicu pembuatan setting dan asset default).

---

### Struktur Direktori & File [L9-38]

```text
domain/user/
├── core/
│   ├── entity/
│   │   └── user.entity.ts
│   ├── model/
│   │   ├── index.ts
│   │   └── user.model.ts
│   ├── ports/
│   │   └── out/
│   │       └── user-repository.port.ts
│   ├── usecase/
│   │   ├── create-user.usecase.ts
│   │   ├── delete-user.usecase.ts
│   │   ├── is-user-id-taken.usecase.ts
│   │   ├── is-username-taken.usecase.ts
│   │   ├── list-users.usecase.ts
│   │   ├── update-user-avatar.usecase.ts
│   │   ├── user-by-id.usecase.ts
│   │   └── user-by-username.usecase.ts
│   └── value-objects/
│       └── logger.ts
├── adapters/
│   ├── driven/
│   │   └── drizzle/
│   │       └── user.repository.ts
│   └── driving/
│       └── graphql/
│           ├── user.gql
│           └── user.resolver.ts
├── index.ts
└── user.composition.ts
```

---

### Penjelasan File Per-File [L39-137]

#### 1. `core/entity/user.entity.ts` [L41-66]

[`core/entity/user.entity.ts`](core/entity/user.entity.ts)

- **`userSchema`** — Zod schema (`z.object({...})`)
  - **Fields:**
    1. `id`: `z.instanceof(ID).optional()` — auto-generated, custom `ID` type from shared kernel
    2. `name`: `z.string().min(1).max(100)` — required
    3. `username`: `z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/)` — required, alphanumeric + underscore only
    4. `email`: `z.email()` — required
    5. `password`: `z.string().min(6)` — required, hashed before storage
    6. `avatarUrl`: `z.string().nullable()` — optional
- **`UserType`** — `z.infer<typeof userSchema>` (type alias)
- **`myUserID`** — Custom Zod schema untuk validasi tipe `ID` (dari shared kernel)
- **`User` class** — Entity dengan private fields, method validasi, dan helper
  - **Properties:** `id`, `name`, `username`, `email`, `password`, `avatarUrl`
  - **`constructor(data)`** — Menerima object `{ name, username, email, password, avatarUrl?, id? }`. Set `id` via `ID.new(data.id)` jika ada
  - **`static new(data)`** — Factory method, shortcut ke `new User(data)`
  - **`idHash` getter** — Mengembalikan `id.toHash` sebagai string, throw jika id belum set
  - **Validation methods (chainable, return `this`):**
    1. `requiredId()` — cek userId bukan Maybe, throw `RequiredErr` jika tidak
    2. `validateName()` — `nameSchema.safeParse(this.name)`
    3. `validateUsername()` — `usernameSchema.safeParse(this.username)`
    4. `validatePassword()` — `passwordSchema.safeParse(this.password)`
    5. `validateAll()` — Chain semua method di atas

#### 2. `core/value-objects/logger.ts` [L67-70]

- Membuat instance logger khusus untuk `UserService` dengan prefix `"UserService"` dan file log `user-service-log.log`

#### 3. `core/ports/out/user-repository.port.ts` [L71-84]

[`services/domain/user/core/ports/out/user-repository.port.ts`](./core/ports/out/user-repository.port.ts)

- **Abstract class `UserRepository`** — Port (out) yang mendefinisikan kontrak repository. UserService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/user.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter). Tidak ada filter userId karena module ini memang mengelola user itu sendiri.

  **Daftar Method:**

  1. **`isWithUsername(username)`** — Cek apakah username sudah terdaftar
     - Parameter:
       - `username: string` — username yang dicek
     - Return: `Promise<boolean>` — `true` jika sudah ada

  2. **`isWithUserId(userId)`** — Cek apakah user ID sudah terdaftar
     - Parameter:
       - `userId: number` — ID yang dicek
     - Return: `Promise<boolean>` — `true` jika sudah ada

  3. **`findByUsername(username)`** — Cari user by username
     - Parameter:
       - `username: string`
     - Return: `Promise<User | null>` — `null` jika tidak ditemukan

  4. **`findById(id)`** — Cari user by ID
     - Parameter:
       - `id: number`
     - Return: `Promise<User | null>` — `null` jika tidak ditemukan

  5. **`findAll()`** — Ambil semua user
     - Parameter: tidak ada
     - Return: `Promise<User[]>`

  6. **`save(user)`** — Insert user baru
     - Parameter:
       - `user: User` — entity User lengkap
     - Return: `Promise<User>` — entity User yang tersimpan

  7. **`update(user)`** — Update user existing
     - Parameter:
       - `user: User` — entity User dengan data baru (ID wajib ada)
     - Return: `Promise<User>` — entity User hasil update

  8. **`delete(id)`** — Hapus user by ID
     - Parameter:
       - `id: number`
     - Return: `Promise<void>` — tidak mengembalikan apa pun

#### 4. `core/usecase/user_service.ts` [L85-99]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)

- **Singleton pattern** — `UserService.getInstance()`
- **Use cases:**
  - `createUser(name, username, password, email?)` — Buat user baru
  - `isUsernameTaken(username)` — Cek eksistensi username
  - `isUserIdTaken(userId)` — Cek eksistensi user ID
  - `users()` — Ambil semua user
  - `userByUsername(username)` — Ambil user by username
  - `user(id)` — Ambil user by ID
  - `deleteUser(userId)` — Hapus user
  - `updateUserAvatar(id, avatarUrl?)` — Update avatar user

#### 5. `adapters/driven/drizzle/user.repository.ts` [L100-107]

[`services/domain/user/adapters/driven/drizzle/user.repository.ts`](./adapters/driven/drizzle/user.repository.ts)

- Implementasi `UserRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Mapping kolom database (`avatar` ↔ `avatarUrl`)
- Query dasar: `select`, `insert`, `update`, `delete` dengan `eq` filter

#### 6. `adapters/driving/graphql/user.gql` [L108-113]

- **Query**: `user(username)` — cari user by username, `users` — list semua user
- **Mutation**: `createUser(input)`, `updateUserAvatar(input)`
- Semua query/mutation dilindungi directive `@authorized`

#### 7. `adapters/driving/graphql/user.resolver.ts` [L114-122]

[`services/domain/user/adapters/driving/graphql/user.resolver.ts`](./adapters/driving/graphql/user.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `UserService`
- Transformasi hasil dari entity ke GraphQL response shape
- Konversi `ID` → `toHash` untuk response
- Mendukung pencarian user by `username` atau by `userAuth.id`

#### 8. `user.composition.ts` [L123-129]

[`services/domain/user/user.composition.ts`](./user.composition.ts)

- **Wiring**: Inisialisasi `UserRepositoryImpl` + `UserService.getInstance()`
- Export singleton `userService` yang digunakan module lain

#### 9. `index.ts` [L130-137]

[`services/domain/user/index.ts`](./index.ts)

- Export `userService` dan `UserType` untuk digunakan module lain

---

### Use Cases [L138-271]

#### `createUser(name, username, password, email?)` — Buat user baru [L140-163]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 30:57)

```ts
async createUser(
  name: string,
  username: string,
  password: string,
  email?: string,
): Promise<UserType>
```

    > `repo.isWithUsername(username)` — cek apakah username sudah terdaftar
    >
    > > `true` → `ConflictError` ("User with username ... already exists")
    > > `false` → `PasswordUtils.hash(password)` — hash password
    > > `User.new({ name, username, email, password: hashed }).validateAll()`
    > > `repo.save(user)`
    > > `user.id undefined` → `Error` ("no id returned")
    > > `user.id defined` → `return user`

---

#### `isUsernameTaken(username)` — Cek eksistensi username [L164-177]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 60:64)

```ts
async isUsernameTaken(username: string): Promise<boolean>
```

    > `repo.isWithUsername(username)`
    >
    > > `return boolean`

---

#### `isUserIdTaken(userId)` — Cek eksistensi user ID [L178-192]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 67:72)

```ts
async isUserIdTaken(userId: ID): Promise<boolean>
```

    > `userId.toNumb`
    >
    > > `repo.isWithUserId(number)`
    > > `return boolean`

---

#### `users()` — Ambil semua user [L193-206]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 75:79)

```ts
async users(): Promise<UserType[]>
```

    > `repo.findAll()`
    >
    > > `return User[]`

---

#### `userByUsername(username)` — Ambil user by username [L207-221]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 82:91)

```ts
async userByUsername(username: string): Promise<UserType>
```

    > `repo.findByUsername(username)`
    >
    > > `null` → `NotFoundError` ("User with username ... not found")
    > > `User` → `return User`

---

#### `user(id)` — Ambil user by ID [L222-237]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 94:104)

```ts
async user(id: ID): Promise<UserType>
```

    > `id.toNumb`
    >
    > > `repo.findById(number)`
    > > `null` → `NotFoundError` ("User with id ...")
    > > `User` → `return User`

---

#### `deleteUser(userId)` — Hapus user [L238-252]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 107:113)

```ts
async deleteUser(userId: ID): Promise<boolean>
```

    > `userId.toNumb`
    >
    > > `repo.delete(number)`
    > > `return true`

---

#### `updateUserAvatar(id, avatarUrl?)` — Update avatar user [L253-271]

[`services/domain/user/app/use-cases/user_service.ts`](./app/use-cases/user_service.ts)(line 116:133)

```ts
async updateUserAvatar(id: ID, avatarUrl?: string | null): Promise<UserType>
```

    > `user(id)` — validasi eksistensi
    >
    > > `NotFoundError` (jika user tidak ada)
    > > `User` ditemukan
    > > `avatarUrl falsy` → `user.avatarUrl = null`
    > > `avatarUrl truthy` → `user.avatarUrl = avatarUrl`
    > > `repo.update(user)`
    > > `return User`

---

### Alur Kerja (Data Flow) [L272-315]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (user.gql → user.resolver.ts)                                │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { user, userAuth, auth, cookie }          │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil UserService (use case layer)               │
│    user.resolver.ts → user_service.ts                           │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. UserService jalankan business logic:                        │
│    - Validasi input (Zod schema di entity)                      │
│    - Cek eksistensi (username taken)                            │
│    - Hash password (PasswordUtils)                              │
│    - Panggil repository interface                               │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. UserRepositoryImpl (driven adapter) eksekusi DB query       │
│    - Drizzle ORM → SQLite D1                                     │
│    - Mapping row → User entity                                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain (Signup Flow) [L316-349]

User module adalah **entry point** saat signup. Berikut alurnya:

```text
signUp mutation (auth.resolver.ts)
    │
    ▼
AuthService.signUp()
    │
    ├──► UserService.createUser()          ← Module USER
    │       ├── cek username taken
    │       ├── hash password
    │       └──→ simpan ke DB
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

**Penting**: Pada `auth_service.ts:70-82`, saat signup:

1. User dibuat via `UserService.createUser()`
2. Asset default `"MyCash"` (tipe `cash`, saldo `0 IDR`) dibuat via `AssetService.createAsset()`
3. Setting default (currency `IDR`, darkMode `false`) dibuat via `SettingService.createDefaultSettings()`
4. Jika pembuatan asset/setting gagal, user yang baru dibuat akan **dihapus** (`deleteUser`) untuk konsistensi data

---

### Catatan Arsitektur [L350-355]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `user.composition.ts` — singleton diinisialisasi saat app startup
- **Cross-module dependency**: `AuthService` bergantung pada `UserServiceLike` (interface, bukan concrete class) untuk memudahkan testing dan decoupling
