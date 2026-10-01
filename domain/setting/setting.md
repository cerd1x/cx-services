## Setting Module — Penjelasan & Alur Kerja [L1-247]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **pengaturan/setting** user dalam sistem. Module ini bertanggung jawab atas preferensi user seperti mata uang (currency) dan mode gelap (dark mode), serta referensi ke asset cash default untuk perhitungan total asset.

---

### Struktur Direktori & File [L9-38]

```text
services/domain/setting/
├── app/
│   └── setting_service.ts           # Application service (orchestrasi use case)
├── core/
│   ├── model/
│   │   └── setting.model.ts         # Model bisnis (data + behavior)
│   ├── usecase/
│   │   └── *.usecase.ts              # Use-case bisnis
│   ├── value-objects/
│   │   └── logger.ts                 # Logger khusus module
│   └── ports/out/
│       └── setting-repository.port.ts   # Abstract port (repository contract)
├── adapters/
│   ├── driving/
│   │   └── graphql/
│   │       ├── setting.gql          # SDL GraphQL
│   │       └── setting.resolver.ts  # Resolvers GraphQL
│   └── driven/
│       └── drizzle/
│           ├── setting.entity.ts    # Drizzle schema + Zod + Entity (persistence)
│           └── setting.repository.ts    # Implementasi repository
└── setting.composition.ts           # Composition root: Service.getInstance(new RepoImpl())
```

---

### Penjelasan File Per-File [L39-125]

#### 1. `adapters/driven/drizzle/setting.entity.ts` [L41-65]

[`services/domain/setting/adapters/driven/drizzle/setting.entity.ts`](./adapters/driven/drizzle/setting.entity.ts)

- **`settingSchema`** — Zod schema (`z.object({...})`)
  - **Fields:**
    1. `id`: `z.number().optional()` — auto-generated
    2. `userId`: `z.number()` — required, referensi ke user
    3. `currency`: `z.string().min(3).default("IDR")` — required, ISO currency code
    4. `darkMode`: `z.boolean().default(false)` — required
    5. `defaultAssetCashId`: `z.number().optional()` — ID dari asset cash default
- **`SettingType`** — `z.infer<typeof settingSchema>` (type alias)
- **`SettingInput`** — `z.input<typeof settingSchema>`
- **`SettingData`** — `z.output<typeof settingSchema>`
- **`Setting` class** — Entity dengan private fields, method setter dengan validasi, dan helper
  - **Properties:** `#id`, `#userId`, `#currency`, `#darkMode`, `#defaultAssetCashId`
  - **`constructor(data)`** — Menerima `SettingData`. Set `id` dan `defaultAssetCashId` via `ID.new()` jika ada
  - **`static new(data)`** — Factory method, validasi Zod
  - **`static defaults(userId)`** — Static method untuk membuat setting default (IDR, darkMode=false)
  - **Getters:** `id`, `userId`, `currency`, `darkMode`, `defaultAssetCashId`, `metadata`
  - **Setter methods (chainable, return `this`):**
    1. `setCurrency(currency)` — validasi Zod, set currency
    2. `setDarkMode(darkMode)` — validasi Zod, set darkMode
    3. `setDefaultAssetCashId(defaultAssetCashId)` — validasi Zod, set defaultAssetCashId

#### 2. `core/value-objects/logger.ts` [L66-69]

- Membuat instance logger khusus untuk `SettingService` dengan prefix `"SettingService"` dan file log `setting-service-log.log`

#### 3. `core/ports/out/setting-repository.port.ts` [L70-77]

[`services/domain/setting/core/ports/out/setting-repository.port.ts`](./core/ports/out/setting-repository.port.ts)

- **Abstract class `SettingRepository`** — Port (out) yang mendefinisikan kontrak repository. SettingService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/setting.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter).

  **Daftar Method:**

  1. **`findByUserId(userId)`** — Cari setting by userId
     - Parameter:
       - `userId: number`
     - Return: `Promise<SettingData | null>` — `null` jika user belum punya setting

  2. **`upsert(setting)`** — Insert jika belum ada, update jika sudah ada (berdasarkan userId)
     - Parameter:
       - `setting: SettingData` — data setting lengkap
     - Return: `Promise<SettingData>` — data setting yang tersimpan

#### 4. `core/usecase/setting.service.ts` [L78-87]

[`services/domain/setting/app/use-cases/setting.service.ts`](./app/use-cases/setting.service.ts)

- **Singleton pattern** — `SettingService.getInstance()`
- **Use cases:**
  - `createDefaultSettings(userId)` — Buat setting default untuk user baru
  - `settingByUserId(userId)` — Ambil setting user, buat default jika belum ada
  - `updateSetting(userId, data)` — Update setting user

#### 5. `adapters/driven/drizzle/setting.repository.ts` [L88-95]

[`services/domain/setting/adapters/driven/drizzle/setting.repository.ts`](./adapters/driven/drizzle/setting.repository.ts)

- Implementasi `SettingRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- `findByUserId` — Cari setting by userId
- `upsert` — Insert jika belum ada, update jika sudah ada (berdasarkan userId)

#### 6. `adapters/driving/graphql/setting.gql` [L96-100]

- **Query**: `setting` — ambil setting user yang login
- **Mutation**: `updateSetting(input)` — update currency dan darkMode

#### 7. `adapters/driving/graphql/setting.resolver.ts` [L101-110]

[`services/domain/setting/adapters/driving/graphql/setting.resolver.ts`](./adapters/driving/graphql/setting.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `SettingService`
- Validasi `userAuth` di setiap resolver
- Transformasi hasil dari entity ke GraphQL response shape
- `setting` query → panggil `settingByUserId(userAuth.id.toNumb)`
- `updateSetting` mutation → panggil `updateSetting(userAuth.id.toNumb, input)`

#### 8. `setting.composition.ts` [L111-117]

[`services/domain/setting/setting.composition.ts`](./setting.composition.ts)

- **Wiring**: Inisialisasi `SettingRepositoryImpl` + `SettingService.getInstance()`
- Export singleton `settingService`

#### 9. `index.ts` [L118-125]

[`services/domain/setting/index.ts`](./index.ts)

- Export `settingService`

---

### Use Cases [L126-174]

#### `createDefaultSettings(userId)` — Buat setting default untuk user baru [L128-142]

[`services/domain/setting/app/use-cases/setting.service.ts`](./app/use-cases/setting.service.ts)(line 26:29)

```ts
async createDefaultSettings(userId: number): Promise<SettingData>
```

    > `Setting.defaults(userId)` — buat entity dengan currency "IDR", darkMode=false
    >
    > > `settingRepo.upsert(setting.metadata as SettingData)`
    > > `return SettingData`

---

#### `settingByUserId(userId)` — Ambil setting user [L143-157]

[`services/domain/setting/app/use-cases/setting.service.ts`](./app/use-cases/setting.service.ts)(line 32:38)

```ts
async settingByUserId(userId: number): Promise<SettingData>
```

    > `settingRepo.findByUserId(userId)`
    >
    > > `null` → `createDefaultSettings(userId)`
    > > `SettingData` → `return SettingData`

---

#### `updateSetting(userId, data)` — Update setting user [L158-174]

[`services/domain/setting/app/use-cases/setting.service.ts`](./app/use-cases/setting.service.ts)(line 41:51)

```ts
async updateSetting(userId: number, data: Partial<SettingInput>): Promise<SettingData>
```

    > `settingByUserId(userId)` — pastikan setting ada
    >
    > > `SettingData` existing
    > > `Setting.new({ ...existing, ...data, userId })` — merge data baru
    > > `settingRepo.upsert(setting.metadata as SettingData)`
    > > `return SettingData`

---

### Alur Kerja (Data Flow) [L175-217]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (setting.gql → setting.resolver.ts)                          │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { setting, userAuth }                      │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil SettingService (use case layer)            │
│    setting.resolver.ts → setting.service.ts                     │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SettingService jalankan business logic:                     │
│    - Ambil setting by userId                                     │
│    - Buat default jika belum ada                                 │
│    - Update setting dengan validasi Zod                          │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. SettingRepositoryImpl (driven adapter) eksekusi DB query     │
│    - Drizzle ORM → SQLite D1                                     │
│    - Upsert berdasarkan userId                                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain (Signup Flow) [L218-240]

Setting module adalah bagian dari **post-signup initialization**:

```text
AuthService.signUp()
    │
    ├──► UserService.createUser()          ← Module USER
    │       └──→ buat user baru
    │
    ├──► AssetService.createAsset()        ← Module ASSET
    │       └──→ buat "MyCash" (cash, IDR 0)
    │       └──→ simpan ID ke setting.defaultAssetCashId
    │
    ├──► SettingService.createDefaultSettings()  ← Module SETTING
    │       └──→ buat setting default (IDR, darkMode=false)
    │
    └──→► AuthRepository.saveToken()        ← Module AUTH
            └──→ session + refresh token
```

---

### Catatan Arsitektur [L241-247]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `setting.composition.ts` — singleton diinisialisasi saat app startup
- **Auto-create Default**: Jika setting user belum ada, otomatis dibuat dengan nilai default
- **defaultAssetCashId**: Menyimpan referensi ke asset cash default untuk menghitung total asset cash user
