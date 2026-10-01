## Assets Module — Penjelasan & Alur Kerja [L1-448]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **aset/asset** user dalam sistem. Module ini bertanggung jawab atas manajemen aset (CRUD), mutasi saldo (add/subtract/swap), dan pelacakan riwayat mutasi aset. Setiap asset memiliki saldo dalam format Balance (ISO code + value) yang mendukung konversi mata uang.

---

### Struktur Direktori & File [L9-41]

```text
domain/assets/
├── core/
│   ├── entity/
│   │   ├── asset-mutation.entity.ts
│   │   └── asset.entity.ts
│   ├── model/
│   │   ├── asset-rules.model.ts
│   │   ├── balance.model.ts
│   │   └── index.ts
│   ├── ports/
│   │   └── out/
│   │       └── asset-repository.port.ts
│   ├── usecase/
│   │   ├── apply-asset-mutation.usecase.ts
│   │   ├── asset-by-id.usecase.ts
│   │   ├── asset-by-name.usecase.ts
│   │   ├── asset-mutations.usecase.ts
│   │   ├── create-asset.usecase.ts
│   │   ├── create-default-asset-cash.usecase.ts
│   │   ├── delete-asset.usecase.ts
│   │   ├── list-assets.usecase.ts
│   │   ├── mutate-add-asset.usecase.ts
│   │   ├── mutate-subtract-asset.usecase.ts
│   │   ├── mutate-swap-asset.usecase.ts
│   │   ├── mutate-transaction-asset.usecase.ts
│   │   └── update-asset.usecase.ts
│   └── value-objects/
│       ├── balance.vo.ts
│       └── logger.ts
├── adapters/
│   ├── driven/
│   │   └── drizzle/
│   │       ├── asset.repository.ts
│   │       └── uow.repository.ts
│   └── driving/
│       └── graphql/
│           ├── asset.gql
│           └── asset.resolver.ts
├── assets.composition.ts
└── index.ts
```

---

### Penjelasan File Per-File [L42-184]

#### 1. `core/entity/asset.entity.ts` [L44-67]

[`core/entity/asset.entity.ts`](core/entity/asset.entity.ts)

- **`AssetType`** — Enum: `bank`, `ewallet`, `cash`, `loan`, `crypto`
- **`currencySchema`** — Zod schema untuk currency metadata: `code` (ISO code), `base`, `exponent`
- **`zBalanceSchema`** — Zod schema untuk instance `Balance`
- **`assetSchema`** — Schema validasi Zod untuk Asset: `id`, `userId`, `balance`, `name`, `type`
- **`AssetInput`** — `z.input<typeof assetSchema>`
- **`AssetData`** — `z.output<typeof assetSchema>`
- **`AssetUpdate`** — `Partial<Pick<AssetData, "name" | "type" | "balance">>`
- **`Asset` class** — Entity dengan properti dan method validasi
  - **Properties:** `#id`, `#name`, `#type`, `#balance`, `#userId`
  - **`constructor(data)`** — Menerima object `AssetData & { balance: Balance }`. Set `id` via `ID.new(data.id)` jika ada
  - **`static new(input)`** — Factory method, validasi Zod + non-negative balance check
  - **Getters:** `userId`, `name`, `type`, `currency`, `balance` (string format "ISO CODE VALUE"), `metadata`, `IdStr`
  - **Setter:** `setId(id)` — set id, return `this` (chainable)
  - **Validation methods (chainable, return `this`):**
    1. `requiredUserId()` — cek userId bukan Maybe
    2. `requiredName()` — `assetSchema.shape.name.safeParse(this.name)`
    3. `requiredType()` — `z.enum(AssetType).safeParse(this.type)`
    4. `requiredBalance()` — `zBalanceSchema.safeParse(this.balance)`
    5. `requiredAll()` — chain semua method di atas

#### 2. `core/entity/asset-mutation.entity.ts` [L68-81]

[`core/entity/asset-mutation.entity.ts`](core/entity/asset-mutation.entity.ts)

- **`MutationType`** — Enum: `add`, `subtract`, `transaction`
- **`assetMutationSchema`** — Schema validasi Zod untuk AssetMutation: `id`, `assetId`, `userId`, `type`, `amount`, `currency`, `balanceBefore`, `balanceAfter`, `description`, `createdAt`
- **`AssetMutationInput`** — `z.input<typeof assetMutationSchema>`
- **`AssetMutationData`** — `z.output<typeof assetMutationSchema>`
- **`AssetMutation` class** — Entity untuk mencatat riwayat mutasi saldo
  - **Properties:** `#id`, `#assetId`, `#userId`, `#type`, `#amount`, `#currency`, `#balanceBefore`, `#balanceAfter`, `#description`, `#createdAt`
  - **Getters:** `assetId`, `userId`, `type`, `amount`, `currency`, `balanceBefore`, `balanceAfter`, `description`, `metadata`
  - **Validation methods:** `requiredId()`, `requiredDescription()`
  - **`static new(input)`** — Factory method, validasi Zod

#### 3. `core/value-objects/balance.vo.ts` [L82-101]

[`services/domain/assets/core/value-objects/balance.vo.ts`](./core/value-objects/balance.vo.ts)

- **`isoCodeList`** — List semua ISO currency code dari `dinero.js/currencies`
- **`isoCodeSchema`** — Zod enum untuk ISO code
- **`currencyToLocale(code)`** — Konversi ISO code ke locale string (misal: `IDR` → `id-ID`)
- **`CurrencyMetaType`** — Tipe metadata currency dari dinero.js
- **`Balance` class** — Value object untuk mengelola saldo uang menggunakan `dinero.js`
  - **Static:** `getSymbol(isoCode)` — dapatkan simbol currency (misal: `Rp`, `$`)
  - **Static:** `zero(currency?)` — buat Balance nol, default IDR
  - **Static:** `new(value: string)` — buat Balance dari string `"ISO_CODE VALUE"` (misal: `"USD 100"`, `"USD 100.50"`)
  - **Static:** `is(value)` — type guard untuk cek apakah value adalah `Balance` atau string format balance
  - **Properties:** `value` (number), `code` (IsoCodeType), `toLocalStr` (formatted locale string)
  - **Method:** `convertTo(targetCurrency, exchangeRate)` — konversi ke currency lain
  - **Method:** `add(value: Balance)` — tambah balance
  - **Method:** `subtract(value: Balance)` — kurangi balance
  - **`toString()`** — return `"CODE VALUE"` format
- **`zBalanceScema`** — Zod schema untuk instanceof Balance dengan refinement

#### 4. `core/value-objects/logger.ts` [L102-105]

- Membuat instance logger khusus untuk `AssetService` dengan prefix `"AssetService"` dan file log `asset-service-log.log`

#### 5. `core/ports/out/asset-repository.port.ts` [L106-119]

[`services/domain/assets/core/ports/out/asset-repository.port.ts`](./core/ports/out/asset-repository.port.ts)

- **Abstract class `AssetRepository`** — Port (out) yang mendefinisikan kontrak repository. AssetService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/asset.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter) dan menerima parameter opsional `tx?: unknown` untuk dukungan D1 transaction via `D1TxCollector.is(tx)`.

  **Tipe data yang dipakai:**
  - `AssetData & { balance: Balance }` — data asset tervalidasi Zod dengan balance sebagai instance `Balance` (bukan string)
  - `AssetUpdate` — `Partial<Pick<AssetData, "name" | "type" | "balance">>`
  - `AssetMutationInput` / `AssetMutationData` — input/output schema Zod entity `AssetMutation`
  - `ID` — domain identifier dari `$services/shared/kernel`

  **Daftar Method:**

  1. **`save(asset, tx?)`** — Insert asset baru
     - Parameter:
       - `asset: AssetData & { balance: Balance }` — data asset tervalidasi Zod, balance sebagai instance `Balance` (bukan string)
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<Asset | null>` — entity `Asset` jika sukses, `null` jika insert gagal (dicek service → throw `Error("invalid return data of asset is null")`)

  2. **`findAll(userId, tx?)`** — Ambil semua asset milik user
     - Parameter:
       - `userId: ID` — pemilik asset
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<Asset[]>` — selalu array (kosong `[]` jika tidak ada)

  3. **`findByName(name, userId, tx?)`** — Cari asset by nama + userId
     - Parameter:
       - `name: string` — nama asset
       - `userId: ID` — pemilik asset
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<Asset | null>` — `null` jika tidak ditemukan (service konversi ke `NotFoundError`/`ConflictError`)

  4. **`findById(userId, assetId, tx?)`** — Cari asset by ID + userId
     - Parameter:
       - `userId: ID` — pemilik asset
       - `assetId: ID` — ID asset yang dicari
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<Asset | null>` — `null` jika tidak ditemukan

  5. **`update(userId, id, data, tx?)`** — Update sebagian field asset (`name`/`type`/`balance`)
     - Parameter:
       - `userId: ID` — pemilik asset
       - `id: number` — ID asset dalam bentuk **number** (`assetId.toNumb`), bukan `ID`
       - `data: AssetUpdate` — field yang mau diupdate (partial)
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<Asset>` — entity `Asset` hasil update

  6. **`delete(name, userId, tx?)`** — Hapus asset by nama + userId
     - Parameter:
       - `name: string` — nama asset
       - `userId: ID` — pemilik asset
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<void>` — tidak mengembalikan apa pun

  7. **`createAssetMutation(assetId, data, tx?)`** — Insert riwayat mutasi saldo ke `assetMutationTable`
     - Parameter:
       - `assetId: ID` — asset yang dimutasi
       - `data: AssetMutationInput` — detail mutasi, object hasil `z.input<typeof assetMutationSchema>`:
         - `id?: number` — opsional, auto-generate oleh DB jika tidak diberikan
         - `assetId: number` — **wajib**, ID asset yang dimutasi (number, bukan `ID`)
         - `userId: ID` — **wajib**, instance `ID` pemilik asset (bukan number)
         - `type: "add" | "subtract" | "transaction" | "swap"` — **wajib**, enum `MutationType`:
           - `"add"` — saldo bertambah
           - `"subtract"` — saldo berkurang
           - `"transaction"` — mutasi netral (pencatatan transaksi tanpa add/subtract)
           - `"swap"` — mutasi perpindahan dana/value/balance antara asset (pencatatan transaksi tanpa add/subtract/transaction)
         - `amount: number` — **wajib**, nominal mutasi (nilai murni, tanpa currency)
         - `currency: string` — **wajib**, ISO code 3 huruf (divalidasi `.length(3)`, misal: `"IDR"`, `"USD"`)
         - `balanceBefore: string` — **wajib**, saldo sebelum mutasi dalam format `"CODE VALUE"` (misal: `"IDR 1000"`)
         - `balanceAfter: string` — **wajib**, saldo sesudah mutasi dalam format `"CODE VALUE"`
         - `description?: string | null` — opsional, keterangan mutasi (`null`/tidak diisi → disimpan sebagai `null`)
         - `createdAt?: string` — opsional, timestamp; diisi DB/service jika tidak diberikan
       - `tx?: unknown` — opsional, D1 transaction context
     - Return: `Promise<AssetMutationData>` — data mutasi yang tersimpan (output schema Zod, field opsional sudah ternormalisasi)
     - Catatan: validasi dilakukan via `AssetMutation.new(input)` — gagal parse Zod → throw `Error` berisi gabungan semua issue

  8. **`findMutationsByAssetId(assetId, userId)`** — Ambil riwayat mutasi by assetId + userId, ordered by `createdAt` desc
     - Parameter:
       - `assetId: ID` — asset yang dicari riwayatnya
       - `userId: ID` — pemilik asset
     - Return: `Promise<AssetMutationData[]>`
     - Catatan: **satu-satunya method tanpa `tx?`** (read-only, tidak ikut transaksi)

  **Pola pemakaian dalam transaksi (Unit of Work):**

  ```ts
  uow.run(async (tx) => {
    await repo.createAssetMutation(assetId, mutationData, tx); // catat mutasi
    await repo.update(userId, assetId.toNumb, { balance }, tx); // update saldo
  }); // keduanya atomik — gagal satu, rollback semua
  ```

#### 6. `app/asset.service.ts` [L120-138]

[`services/domain/assets/app/asset.service.ts`](./app/asset.service.ts)

- **Singleton pattern** — `AssetService.getInstance()`
- **Use cases:**
  - `createAsset(input)` — Buat asset baru
  - `createDefaultAssetCash(userId)` — Buat asset cash default "MyCash" (IDR 0)
  - `assets(userId)` — Ambil semua asset user
  - `assetByName(name, userId)` — Ambil asset by nama
  - `assetById(userId, assetId)` — Ambil asset by ID
  - `updateAsset(userId, assetId, input)` — Update asset
  - `mutateAddAsset(userId, assetId, amount)` — Tambah saldo asset
  - `mutateSubtractAsset(userId, assetId, amount)` — Kurangi saldo asset
  - `mutateTransactionAsset(userId, assetId, amount, description?)` — Mutasi saldo (tanpa add/subtract)
  - `swapBalance(userId, fromAssetId, toAssetId, amount)` — Pindah saldo antar asset
  - `deleteAsset(name, userId)` — Hapus asset
  - `assetMutations(userId, assetId)` — Ambil riwayat mutasi

#### 7. `adapters/driven/drizzle/asset.repository.ts` [L139-148]

[`services/domain/assets/adapters/driven/drizzle/asset.repository.ts`](./adapters/driven/drizzle/asset.repository.ts)

- Implementasi `AssetRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Mendukung D1 transaction via `D1TxCollector.is(tx)` check
- Mapping kolom database: `balance` (number), `currency` (string ISO code)
- `createAssetMutation` — insert ke `assetMutationTable`
- `findMutationsByAssetId` — query riwayat mutasi by assetId + userId, ordered by `createdAt` desc

#### 8. `adapters/driven/drizzle/uow.repository.ts` [L149-152]

- Implementasi `UnitOfWork` untuk D1 transaction support

#### 9. `adapters/driving/graphql/asset.gql` [L153-157]

- **Query**: `assets`, `asset(name)`, `assetById(id)`, `assetMutations(assetId)`
- **Mutation**: `createAsset(input)`, `updateAsset(id, input)`, `addBalance(assetId, amount)`, `subtractBalance(assetId, amount)`, `deleteAsset(name)`, `swapBalance(fromAssetId, toAssetId, amount)`

#### 10. `adapters/driving/graphql/asset.resolver.ts` [L158-169]

[`services/domain/assets/adapters/driving/graphql/asset.resolver.ts`](./adapters/driving/graphql/asset.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `AssetService`
- Transformasi hasil dari entity ke GraphQL response shape
- Konversi `ID` → `toHash` untuk response
- `balance` → string format `"ISO CODE VALUE"`
- `type` → cast ke `AssetType` enum
- `mutateAddAsset` / `mutateSubtractAsset` — panggil AssetService dan catat transaksi via `TransactionService`
- `swapBalance` — panggil AssetService swap, catat sebagai `transfer` transaction

#### 11. `asset.composition.ts` [L170-176]

[`services/domain/assets/asset.composition.ts`](./assets.composition.ts)

- **Wiring**: Inisialisasi `AssetRepositoryImpl` + `UnitOfWorkImpl` + `AssetService.getInstance()`
- Export singleton `assetService`

#### 12. `index.ts` [L177-184]

[`services/domain/assets/index.ts`](./index.ts)

- Export `assetService` dan `Balance`

---

### Use cases [L185-368]

- [createAsset](services/domain/assets/app/asset.service.ts)(line 34:53) Buat asset baru

```ts
async createAsset(input: AssetInput): Promise<Asset>
```

    > `assetRepo.findByName(input.name, input.userId)` — cek duplicate
    > > duplicate → `ConflictError` ("Asset with name ... already exists")
    > > unik → `Asset.new({ name, balance, type, userId }).requiredAll()`
    > > validasi gagal → `Error`
    > > validasi berhasil → `assetRepo.save({ name, type, balance, userId })`
    > > result null → `Error` ("invalid return data of asset is null")
    > > result defined → `return result`

---

- [createDefaultAssetCash](services/domain/assets/app/asset.service.ts)(line 57:63) Buat asset cash default

```ts
async createDefaultAssetCash(userId: ID): Promise<Asset>
```

    > `createAsset({ userId, name: "MyCash", type: "cash", balance: Balance.zero("IDR") })`
    >
    > > return Asset

---

- [assets](services/domain/assets/app/asset.service.ts)(line 67:70) Ambil semua asset user

```ts
async assets(userId: ID): Promise<Asset[]>
```

    > `assetRepo.findAll(userId)`
    >
    > > `return Asset[]`

---

- [assetByName](services/domain/assets/app/asset.service.ts)(line 73:79) Ambil asset by nama

```ts
async assetByName(name: string, userId: ID): Promise<Asset>
```

    > `assetRepo.findByName(name, userId)`
    >
    > > null → `NotFoundError` ("Asset ${name}")
    > > `Asset` → `return Asset`

---

- [assetById](services/domain/assets/app/asset.service.ts)(line 82:84) Ambil asset by ID

```ts
async assetById(userId: ID, assetId: ID): Promise<Asset | null>
```

    > `assetRepo.findById(userId, assetId)`
    >
    > > `Asset | null`

---

- [updateAsset](services/domain/assets/app/asset.service.ts)(line 87:98) Update asset

```ts
async updateAsset(userId: ID, assetId: ID, input: Partial<AssetInput> & { balance?: Balance }): Promise<Asset>
```

    > build `AssetUpdate` data object from input
    >
    > > `assetRepo.update(userId, assetId.toNumb, data)`
    > > `return Asset`

---

- [mutateAddAsset](services/domain/assets/app/asset.service.ts)(line 149:169) Tambah saldo asset

```ts
async mutateAddAsset(userId: ID, assetId: ID, amount: string): Promise<Asset>
```

    > `Balance.new(amount)` — parse string ke Balance
    >
    > > `#applyMutation(userId, assetId, "add", balanceAmount)`
    > >     > `assetRepo.findById(userId, assetId)` — cek asset ada
    > >     > null → `NotFoundError`
    > >     > `current = Balance.new(asset.balance)` — clone balance saat ini
    > >     > `current.add(amount)` — tambah saldo
    > >     > `uow.run(async tx => {`
    > >     >     > `assetRepo.createAssetMutation(assetId, { type: "add", amount, currency, balanceBefore, balanceAfter, description }, tx)`
    > >     >     > `assetRepo.update(userId, assetId.toNumb, { balance: current }, tx)`
    > >     > `})`
    > >     > `return Asset.new({ id, userId, name, type, balance: current })`
    > >
    > > Setelah mutation berhasil → `TransactionService.getInstance().createTransaction()`
    > >     > type: "income", category: "Add Balance", description: "Add Balance TO ( ${result.name} )"

---

- [mutateSubtractAsset](services/domain/assets/app/asset.service.ts)(line 172:192) Kurangi saldo asset

```ts
async mutateSubtractAsset(userId: ID, assetId: ID, amount: string): Promise<Asset>
```

    > `Balance.new(amount)` — parse string ke Balance
    >
    > > `#applyMutation(userId, assetId, "subtract", balanceAmount)`
    > >     > `assetRepo.findById(userId, assetId)` — cek asset ada
    > >     > null → `NotFoundError`
    > >     > `current = Balance.new(asset.balance)` — clone balance saat ini
    > >     > `current.subtract(amount)` — kurangi saldo
    > >     > `uow.run(async tx => {`
    > >     >     > `assetRepo.createAssetMutation(assetId, { type: "subtract", amount, currency, balanceBefore, balanceAfter, description }, tx)`
    > >     >     > `assetRepo.update(userId, assetId.toNumb, { balance: current }, tx)`
    > >     > `})`
    > >     > `return Asset.new({ id, userId, name, type, balance: current })`
    > >
    > > Setelah mutation berhasil → `TransactionService.getInstance().createTransaction()`
    > >     > type: "outcome", category: "Subtract Balance", description: "Subtract Balance FROM ( ${result.name} )"

---

- [swapBalance](services/domain/assets/app/asset.service.ts)(line 205:291) Pindah saldo antar asset

```ts
async swapBalance(userId: ID, fromAssetId: ID, toAssetId: ID, amount: string): Promise<{ from: Asset; to: Asset }>
```

    > `Balance.new(amount)` — parse string ke Balance
    >
    > > `assetRepo.findById(userId, fromAssetId)` — cek source asset
    > > null → `NotFoundError` ("Source asset ${fromAssetId.toHash}")
    > > `assetRepo.findById(userId, toAssetId)` — cek dest asset
    > > null → `NotFoundError` ("Destination asset ${toAssetId.toHash}")
    > >
    > > `fromCurrent = Balance.new(fromAsset.balance)`
    > > `toCurrent = Balance.new(toAsset.balance)`
    > >
    > > `fromCurrent.subtract(balanceAmount)`
    > > `toCurrent.add(balanceAmount)`
    > >
    > > `uow.run(async tx => {`
    > >     > `assetRepo.createAssetMutation(fromAssetId, { type: "subtract", ... }, tx)`
    > >     > `assetRepo.createAssetMutation(toAssetId, { type: "add", ... }, tx)`
    > >     > `assetRepo.update(userId, fromAssetId.toNumb, { balance: fromCurrent }, tx)`
    > >     > `assetRepo.update(userId, toAssetId.toNumb, { balance: toCurrent }, tx)`
    > > `})`
    > >
    > > `TransactionService.getInstance().createTransaction()` — catat sebagai transfer
    > >     > type: "transfer", category: "Move Balances", description: "Swap ( ${fromAsset.name} to ${toAsset.name} )"
    > >
    > > `return { from: Asset.new({...fromCurrent}), to: Asset.new({...toCurrent}) }`

---

- [deleteAsset](services/domain/assets/app/asset.service.ts)(line 294:296) Hapus asset

```ts
async deleteAsset(name: string, userId: ID): Promise<void>
```

    > `assetRepo.delete(name, userId)`
    >
    > > `return void`

---

- [assetMutations](services/domain/assets/app/asset.service.ts)(line 299:301) Ambil riwayat mutasi

```ts
async assetMutations(userId: ID, assetId: ID): Promise<AssetMutationData[]>
```

    > `assetRepo.findMutationsByAssetId(assetId, userId)`
    >
    > > `return AssetMutationData[]`

---

### Alur Kerja (Data Flow) [L369-415]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (asset.gql → asset.resolver.ts)                             │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { asset, userAuth }                       │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil AssetService (use case layer)              │
│    asset.resolver.ts → asset.service.ts                        │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. AssetService jalankan business logic:                       │
│    - Validasi input (Zod schema di entity)                      │
│    - Hitung balance (add/subtract/swap)                         │
│    - Catat mutasi di assetMutationTable                         │
│    - Update balance di assetTable                               │
│    - Panggil TransactionService untuk catat transaksi           │
│    - Panggil repository interface                                │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. AssetRepositoryImpl (driven adapter) eksekusi DB query      │
│    - Drizzle ORM → SQLite D1                                    │
│    - Mapping row → Asset entity                                  │
│    - Support D1 transaction via D1TxCollector                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                 │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain [L416-438]

Assets module berinteraksi dengan module lain melalui `TransactionService`:

```text
mutateAddAsset() / mutateSubtractAsset() / swapBalance()
    │
    └──→► TransactionService.createTransaction()  ← Module TRANSACTIONS
            └──→ catat mutasi asset sebagai transaksi

OrderService.createOrderProductSale()
    │
    └──→► AssetService.mutateAddAsset()  ← Module ASSETS
            └──→ tambah saldo asset saat penjualan produk

OrderService.createOrderExpense() / createOrderLoan()
    │
    └──→► AssetService.mutateSubtractAsset()  ← Module ASSETS
            └──→ kurangi saldo asset saat expense/loan
```

---

### Catatan Arsitektur [L439-448]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `asset.composition.ts` — singleton diinisialisasi saat app startup
- **Balance Storage**: `balance` disimpan sebagai number di database, `currency` sebagai string ISO code terpisah
- **Mutation Tracking**: Setiap perubahan saldo dicatat di `assetMutationTable` dengan `balanceBefore` dan `balanceAfter`
- **Cross-module integration**: Dipanggil oleh `OrderService` untuk mutasi saldo saat order penjualan/pengeluaran
- **Unit of Work**: Mendukung D1 transaction via `D1TxCollector` untuk operasi atomik (mutation + update)
- **Balance Value Object**: Menggunakan `dinero.js` untuk aritmatika uang yang presisi, mendukung konversi currency
