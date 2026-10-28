## Assets Module — Penjelasan & Alur Kerja [L1-448]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **aset/asset** user dalam sistem. Module ini bertanggung jawab atas manajemen aset (CRUD), mutasi saldo (add/subtract/swap), dan pelacakan riwayat mutasi aset. Setiap asset memiliki saldo berupa instance `Money` (dari `@lib/money`); format string "ISO code + value" hanya dipakai di boundary GraphQL.

---

### Struktur Direktori & File [L9-41]

```text
domain/assets/
├── core/
│   ├── model/
│   │   ├── asset-mutation.model.ts
│   │   ├── asset.model.ts
│   │   └── index.ts
│   ├── ports/
│   │   └── out/
│   │       └── asset-repository.port.ts
│   ├── usecase/
│   │   ├── apply_asset_mutation.usecase.ts
│   │   ├── asset_by_id.usecase.ts
│   │   ├── asset_by_name.usecase.ts
│   │   ├── asset_mutations.usecase.ts
│   │   ├── create_asset.usecase.ts
│   │   ├── create_default_asset_cash.usecase.ts
│   │   ├── delete_asset.usecase.ts
│   │   ├── list_assets.usecase.ts
│   │   ├── mutate_add_asset.usecase.ts
│   │   ├── mutate_subtract_asset.usecase.ts
│   │   ├── mutate_swap_asset.usecase.ts
│   │   ├── mutate_transaction_asset.usecase.ts
│   │   └── update_asset.usecase.ts
│   └── value-objects/
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

#### 1. `core/model/asset.model.ts` [L44-67]

[`core/model/asset.model.ts`](core/model/asset.model.ts)

- **`AssetType`** — Enum: `bank`, `ewallet`, `cash`, `loan`, `crypto`
- **`currencySchema`** — Zod schema untuk currency metadata: `code` (ISO code), `base`, `exponent`
- **`moneySchema`** — Zod schema (`z.custom<Money>`) yang memastikan nilai adalah instance `Money` (`@lib/money`)
- **`assetSchema`** — Schema validasi Zod untuk Asset: `id`, `userId`, `balance`, `name`, `type`
- **`AssetInput`** — `z.input<typeof assetSchema>`
- **`AssetData`** — `z.output<typeof assetSchema>`
- **`AssetUpdate`** — `Partial<Pick<AssetData, "name" | "type" | "balance">>`
- **`Asset` class** — Entity dengan properti dan method validasi
  - **Properties:** `#id`, `#name`, `#type`, `#balance`, `#userId`
  - **`constructor(data)`** — Menerima object `AssetData & { balance: Money }`. Set `id` via `ID.new(data.id)` jika ada
  - **`static new(input)`** — Factory method, validasi Zod + non-negative balance check
  - **Getters:** `userId`, `name`, `type`, `currency`, `balance` (instance `Money`), `metadata`, `IdStr`
  - **Setter:** `setId(id)` — set id, return `this` (chainable)
  - **Validation methods (chainable, return `this`):**
    1. `requiredUserId()` — cek userId bukan Maybe
    2. `requiredName()` — `assetSchema.shape.name.safeParse(this.name)`
    3. `requiredType()` — `z.enum(AssetType).safeParse(this.type)`
    4. `requiredBalance()` — `moneySchema.safeParse(this.balance)`
    5. `requiredAll()` — chain semua method di atas

#### 2. `core/model/asset-mutation.model.ts` [L68-81]

[`core/model/asset-mutation.model.ts`](core/model/asset-mutation.model.ts)

- **`MutationType`** — Enum: `add`, `subtract`, `transaction`, `swap`
- **`assetMutationSchema`** — Schema validasi Zod untuk AssetMutation: `id`, `assetId`, `userId`, `type`, `amount`, `balanceBefore`, `balanceAfter`, `description`, `createdAt`. Tidak ada field `currency` — nilainya diturunkan dari `amount.currency.code`
- **`AssetMutationInput`** — `z.input<typeof assetMutationSchema>`
- **`AssetMutationData`** — `z.output<typeof assetMutationSchema>`
- **`AssetMutation` class** — Entity untuk mencatat riwayat mutasi saldo
  - **Properties:** `#id`, `#assetId`, `#userId`, `#type`, `#amount`, `#balanceBefore`, `#balanceAfter`, `#description`, `#createdAt`
  - **Getters:** `assetId`, `userId`, `type`, `amount` (`Money`), `currency` (`Money.currency.code`), `balanceBefore` (`Money`), `balanceAfter` (`Money`), `description`, `metadata`
  - **Validation methods:** `requiredId()`, `requiredDescription()`
  - **`static new(input)`** — Factory method, validasi Zod

#### 3. Uang — `@lib/money` dan boundary GraphQL/DB

Saldo **tidak** memakai value object sendiri; tipe uang adalah `Money` dari package
`@lib/money` (workspace `lib/money/`). Package ini **tidak** lagi menyediakan codec
string (`parseMoney`/`formatMoney` sudah dihapus): di dalam domain uang selalu
berupa instance `Money`.

Konversi hanya terjadi di dua boundary:

- **GraphQL** — scalar `Money` di
  [`shared/infra/graphql/scalars/money.ts`](../../shared/infra/graphql/scalars/money.ts).
  Wire format tetap string `"KODE NOMINAL"` (mis. `"IDR 1500000"`), di-parse jadi
  `Money` (hanya ISO 4217 spendable, dibulatkan `Round.HalfUp` ke exponent) dan
  di-serialize kembali ke string.
- **Database** — helper
  [`shared/infra/db/money.ts`](../../shared/infra/db/money.ts):
  - `toMinorUnits(money)` / `fromMinorUnits(value, code)` untuk tabel yang punya
    kolom `currency` (`asset.balance`, `asset_mutation.amount`,
    `asset_mutation.balance_before`, `asset_mutation.balance_after`) — disimpan
    sebagai integer **minor unit** (satuan terkecil; IDR `1500000` → `150000000`
    karena exponent IDR = 2).
  - `serializeMoney(money)` / `deserializeMoney(text)` untuk tabel tanpa kolom
    `currency` (`transaction.amount`, `transaction.capital`) — disimpan sebagai
    TEXT string instance `Money`, mis.
    `"IDR 1500000"`.

Operasi aritmetika pakai API `Money` (immutable — `add`/`subtract` mengembalikan instance baru):
`money.add(other)`, `money.subtract(other)`, `money.lt(other)`, `money.isNegative()`,
`money.toNumber()`, `money.currency.code`.

#### 4. `core/value-objects/logger.ts` [L102-105]

- Membuat instance logger khusus untuk `AssetService` dengan prefix `"AssetService"` dan file log `asset-service-log.log`

#### 5. `core/ports/out/asset-repository.port.ts` [L106-119]

[`services/domain/assets/core/ports/out/asset-repository.port.ts`](./core/ports/out/asset-repository.port.ts)

- **Abstract class `AssetRepository`** — Port (out) yang mendefinisikan kontrak repository. AssetService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/asset.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter) dan menerima parameter opsional `tx?: unknown` untuk dukungan D1 transaction via `D1TxCollector.is(tx)`.

  **Tipe data yang dipakai:**
  - `AssetData & { balance: Money }` — data asset tervalidasi Zod dengan balance sebagai instance `Money` (bukan string)
  - `AssetUpdate` — `Partial<Pick<AssetData, "name" | "type" | "balance">>`
  - `AssetMutationInput` / `AssetMutationData` — input/output schema Zod entity `AssetMutation`
  - `ID` — domain identifier dari `$services/shared/kernel`

  **Daftar Method:**

  1. **`save(asset, tx?)`** — Insert asset baru
     - Parameter:
       - `asset: AssetData & { balance: Money }` — data asset tervalidasi Zod, balance sebagai instance `Money` (bukan string)
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
         - `type: "CR" | "DB" | "TF" | "EB" | "ADM"` — **wajib**, enum `MutationType`:
           - `"CR"` — credit (saldo bertambah)
           - `"DB"` — debit (saldo berkurang)
           - `"EB"` — transaksi e-wallet/banking (debit)
           - `"TF"` — transfer perpindahan dana antara asset (from -> to)
           - `"ADM"` — biaya admin (debit)
           - Nilai ini juga ditegakkan di database oleh `CHECK` constraint `asset_mutation_type_check`; `asset.type` oleh `asset_type_check`. Keduanya ditulis eksplisit di `drizzle-schema` karena drizzle-kit tidak menurunkan `CHECK` dari `enum`.
         - `amount: Money` — **wajib**, nominal mutasi sebagai instance `Money` (currency ikut di dalamnya)
         - `balanceBefore: Money` — **wajib**, saldo sebelum mutasi
         - `balanceAfter: Money` — **wajib**, saldo sesudah mutasi
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
  - `mutateAsset(input)` — Mutasi terpadu ala perbankan (CR/DB/TF/EB/ADM), satu usecase untuk semua arus dana
  - `transferAsset(userId, fromAssetId, toAssetId, amount)` — Pindah saldo antar asset (code `TF`)
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
- **Mutation**: `createAsset(input)`, `updateAsset(id, input)`, `addBalance(assetId, amount)`, `subtractBalance(assetId, amount)`, `deleteAsset(name)`, `swapBalance(fromAssetId, toAssetId, amount)` — semua argumen/nilai uang bertipe scalar `Money` (wire: string `"KODE NOMINAL"`)

#### 10. `adapters/driving/graphql/asset.resolver.ts` [L158-169]

[`services/domain/assets/adapters/driving/graphql/asset.resolver.ts`](./adapters/driving/graphql/asset.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `AssetService`
- Transformasi hasil dari entity ke GraphQL response shape
- Konversi `ID` → `toHash` untuk response
- `balance` → instance `Money` (di-serialize scalar `Money` jadi string `"KODE NOMINAL"`)
- `type` → cast ke `AssetType` enum
- `mutateAddAsset` / `mutateSubtractAsset` — panggil AssetService dan catat transaksi via `TransactionService`
- `swapBalance` — panggil AssetService swap, catat sebagai `transfer` transaction

#### 11. `asset.composition.ts` [L170-176]

[`services/domain/assets/asset.composition.ts`](./assets.composition.ts)

- **Wiring**: Inisialisasi `AssetRepositoryImpl` + `UnitOfWorkImpl` + `AssetService.getInstance()`
- Export singleton `assetService`

#### 12. `index.ts` [L177-184]

[`services/domain/assets/index.ts`](./index.ts)

- Export `assetService`

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

    > `createAsset({ userId, name: "MyCash", type: "cash", balance: Money.zero(iso.IDR) })`
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
async updateAsset(userId: ID, assetId: ID, input: Partial<AssetInput> & { balance?: Money }): Promise<Asset>
```

    > build `AssetUpdate` data object from input
    >
    > > `assetRepo.update(userId, assetId.toNumb, data)`
    > > `return Asset`

---

- [mutateAsset](services/domain/assets/core/usecase/mutate_asset.usecase.ts)(line 74:145) Mutasi saldo terpadu ala perbankan (CR/DB/TF/EB/ADM)

```ts
async mutateAddAsset(userId: ID, assetId: ID, amount: Money): Promise<Asset>
```

    > > `#applyMutation(userId, assetId, "CR", balanceAmount)`
    > >     > `assetRepo.findById(userId, assetId)` — cek asset ada
    > >     > null → `NotFoundError`
    > >     > `current = asset.balance` — saldo saat ini (`Money`)
    > >     > `next = current.add(amount)` — tambah saldo (Money immutable → instance baru)
    > >     > `uow.run(async tx => {`
    > >     >     > `assetRepo.createAssetMutation(assetId, { type: "add", amount, currency, balanceBefore, balanceAfter, description }, tx)`
    > >     >     > `assetRepo.update(userId, assetId.toNumb, { balance: current }, tx)`
    > >     > `})`
    > >     > `return Asset.new({ id, userId, name, type, balance: current })`
    > >
    > > Setelah mutation berhasil → `TransactionService.getInstance().createTransaction()`
    > >     > type: "income", category: "Credit", description: "CR Credit To ( ${result.name} )"

---

- [mutateSubtractAsset](services/domain/assets/app/asset.service.ts)(line 172:192) Kurangi saldo asset

```ts
async mutateSubtractAsset(userId: ID, assetId: ID, amount: Money): Promise<Asset>
```

    > > `#applyMutation(userId, assetId, "subtract", balanceAmount)`
    > >     > `assetRepo.findById(userId, assetId)` — cek asset ada
    > >     > null → `NotFoundError`
    > >     > `current = asset.balance` — saldo saat ini (`Money`)
    > >     > `next = current.subtract(amount)` — kurangi saldo (Money immutable → instance baru)
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
async swapBalance(userId: ID, fromAssetId: ID, toAssetId: ID, amount: Money): Promise<{ from: Asset; to: Asset }>
```

    > > `assetRepo.findById(userId, fromAssetId)` — cek source asset
    > > null → `NotFoundError` ("Source asset ${fromAssetId.toHash}")
    > > `assetRepo.findById(userId, toAssetId)` — cek dest asset
    > > null → `NotFoundError` ("Destination asset ${toAssetId.toHash}")
    > >
    > > `fromNext = fromAsset.balance.subtract(balanceAmount)`
    > > `toNext = toAsset.balance.add(balanceAmount)`
    > >
    > > `uow.run(async tx => {`
    > >     > `assetRepo.createAssetMutation(fromAssetId, { type: "subtract", ... }, tx)`
    > >     > `assetRepo.createAssetMutation(toAssetId, { type: "add", ... }, tx)`
    > >     > `assetRepo.update(userId, fromAssetId.toNumb, { balance: fromNext }, tx)`
    > >     > `assetRepo.update(userId, toAssetId.toNumb, { balance: toNext }, tx)`
    > > `})`
    > >
    > > `TransactionService.getInstance().createTransaction()` — catat sebagai transfer
    > >     > type: "transfer", category: "Move Balances", description: "Swap ( ${fromAsset.name} to ${toAsset.name} )"
    > >
    > > `return { from: Asset.new({...fromNext}), to: Asset.new({...toNext}) }`

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
- **Balance Storage**: `balance` disimpan sebagai integer **minor unit** (satuan terkecil) di database, `currency` sebagai string ISO code terpisah. Konversi via `toMinorUnits()`/`fromMinorUnits()` di `shared/infra/db/money.ts`
- **Mutation Tracking**: Setiap perubahan saldo dicatat di `assetMutationTable` dengan `balanceBefore` dan `balanceAfter`
- **Cross-module integration**: Dipanggil oleh `OrderService` untuk mutasi saldo saat order penjualan/pengeluaran
- **Unit of Work**: Mendukung D1 transaction via `D1TxCollector` untuk operasi atomik (mutation + update)
- **Money**: Aritmetika uang memakai `Money` dari `@lib/money` (immutable, presisi). Di domain uang selalu instance `Money`; string `"KODE NOMINAL"` hanya di-parse/format oleh scalar GraphQL `Money` (`shared/infra/graphql/scalars/money.ts`)
