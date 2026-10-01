## Transactions Module — Penjelasan & Alur Kerja [L1-387]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **transaksi keuangan** dalam sistem. Module ini bertanggung jawab atas manajemen transaksi (CRUD), tracking tipe transaksi (income, expense, transfer, outcome), status, metode pembayaran, dan integrasi dengan asset untuk mutasi saldo.

---

### Struktur Direktori & File [L9-38]

```text
services/domain/transactions/
├── app/
│   └── transactions_service.ts           # Application service (orchestrasi use case)
├── core/
│   ├── model/
│   │   └── transactions.model.ts         # Model bisnis (data + behavior)
│   ├── usecase/
│   │   └── *.usecase.ts              # Use-case bisnis
│   ├── value-objects/
│   │   └── logger.ts                 # Logger khusus module
│   └── ports/out/
│       └── transactions-repository.port.ts   # Abstract port (repository contract)
├── adapters/
│   ├── driving/
│   │   └── graphql/
│   │       ├── transactions.gql          # SDL GraphQL
│   │       └── transactions.resolver.ts  # Resolvers GraphQL
│   └── driven/
│       └── drizzle/
│           ├── transactions.entity.ts    # Drizzle schema + Zod + Entity (persistence)
│           └── transactions.repository.ts    # Implementasi repository
└── transactions.composition.ts           # Composition root: Service.getInstance(new RepoImpl())
```

---

### Penjelasan File Per-File [L39-148]

#### 1. `adapters/driven/drizzle/transaction.entity.ts` [L41-76]

[`services/domain/transactions/adapters/driven/drizzle/transaction.entity.ts`](./adapters/driven/drizzle/transaction.entity.ts)

- **`TransactionType`** — Enum: `income`, `expense`, `transfer`, `outcome`
- **`TransactionStatus`** — Enum: `pending`, `success`, `failed`
- **`PaymentMethodType`** — Enum: `cash`, `bank_transfer`, `ewallet`, `credit_card`, `debit_card`, `credit`
- **`paymentMethodSchema`** — Schema untuk payment method: `type` (enum), `assetId` (opsional)
- **`transactionSchema`** — Schema validasi Zod untuk Transaction:
  - **Fields:**
    1. `id`: `z.number().optional()` — auto-generated
    2. `userId`: `z.number().optional()`
    3. `type`: `z.enum(["income", "expense", "transfer", "outcome"])` — required
    4. `status`: `z.enum(["pending", "success", "failed"]).default("pending")` — required
    5. `paymentMethod`: `paymentMethodSchema.default({ type: "cash" })` — required
    6. `customerId`: `z.number().optional()` — ID customer (untuk order)
    7. `amount`: `z.number().positive()` — required, jumlah transaksi
    8. `capital`: `z.number().positive()` — required, modal
    9. `description`: `z.string().max(500).optional()`
    10. `category`: `z.string().max(100).optional()`
    11. `createdAt`: `z.date()` — required
    12. `updatedAt`: `z.date().optional()`
- **`TransactionData`** — `z.infer<typeof transactionSchema>`
- **`TransactionUpdateData`** — Partial type untuk update transaksi
- **`Transaction` class** — Entity dengan properti dan method validasi
  - **Properties:** `id`, `userId`, `type`, `status`, `paymentMethod`, `customerId`, `amount`, `capital`, `description`, `category`, `createdAt`, `updatedAt`
  - **`constructor(data)`** — Menerima object dengan `type`, `amount` (Balance), `capital` (Balance), dan field opsional lainnya
  - **`static new(data)`** — Factory method, shortcut ke `new Transaction(data)`
  - **Validation methods (chainable, return `this`):**
    1. `validateType()` — `typeSchema.safeParse(this.type)`
    2. `validateDescription()` — `descriptionSchema.safeParse(this.description)` (skip if undefined)
    3. `validateCategory()` — `categorySchema.safeParse(this.category)` (skip if undefined)
    4. `validateStatus()` — `statusSchema.safeParse(this.status)`
    5. `validatePaymentMethod()` — `paymentMethodSchema.safeParse(this.paymentMethod)`
    6. `validateAll()` — Chain semua method di atas

#### 2. `core/value-objects/logger.ts` [L77-80]

- Membuat instance logger khusus untuk `TransactionService` dengan prefix `"TransactionService"` dan file log `transaction-service-log.log`

#### 3. `core/ports/out/transaction-repository.port.ts` [L81-93]

[`services/domain/transactions/core/ports/out/transaction-repository.port.ts`](./core/ports/out/transaction-repository.port.ts)

- **Abstract class `TransactionRepository`** — Port (out) yang mendefinisikan kontrak repository. TransactionService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/transaction.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter). `userId` bertipe `ID` (domain identifier dari shared kernel).

  **Daftar Method:**

  1. **`save(tx)`** — Insert transaksi baru
     - Parameter:
       - `tx: Transaction` — entity Transaction lengkap
     - Return: `Promise<Transaction>` — entity Transaction yang tersimpan

  2. **`findById(id, userId)`** — Cari transaksi by ID + pemilik
     - Parameter:
       - `id: number` — ID transaksi
       - `userId: ID` — pemilik transaksi
     - Return: `Promise<Transaction | null>` — `null` jika tidak ditemukan

  3. **`findAll(userId)`** — Ambil semua transaksi milik user
     - Parameter:
       - `userId: ID` — pemilik transaksi
     - Return: `Promise<Transaction[]>` — selalu array (kosong `[]` jika tidak ada)

  4. **`findByType(type, userId)`** — Ambil transaksi by tipe
     - Parameter:
       - `type: string` — tipe transaksi (`income`/`outcome`/`transfer`)
       - `userId: ID` — pemilik transaksi
     - Return: `Promise<Transaction[]>`

  5. **`findByDateRange(start, end, userId)`** — Ambil transaksi dalam rentang tanggal
     - Parameter:
       - `start: Date` — batas awal
       - `end: Date` — batas akhir
       - `userId: ID` — pemilik transaksi
     - Return: `Promise<Transaction[]>`

  6. **`update(tx, userId)`** — Update transaksi existing
     - Parameter:
       - `tx: Transaction` — entity Transaction dengan data baru
       - `userId: ID` — pemilik transaksi (guard akses)
     - Return: `Promise<Transaction>` — entity Transaction hasil update

  7. **`delete(id, userId)`** — Hapus transaksi by ID + pemilik
     - Parameter:
       - `id: number` — ID transaksi
       - `userId: ID` — pemilik transaksi
     - Return: `Promise<void>` — tidak mengembalikan apa pun

#### 4. `core/usecase/transaction.service.ts` [L94-110]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)

- **Singleton pattern** — `TransactionService.getInstance()`
- **Use cases:**
  - `createTransaction(input)` — Buat transaksi baru
  - `transaction(id, userId)` — Ambil transaksi by ID
  - `transactions(userId)` — Ambil semua transaksi user
  - `transactionsByType(type, userId)` — Ambil transaksi by tipe
  - `transactionsByDateRange(start, end, userId)` — Ambil transaksi by rentang tanggal
  - `updateTransaction(id, data, userId)` — Update transaksi
  - `deleteTransaction(id, userId)` — Hapus transaksi
  - `requestFormTransaction(userId)` — Generate hash form untuk CSRF protection
  - `validateCSRFToken(token, userId)` — Validasi CSRF token
  - `requestFormCSRFToken(userId)` — Generate CSRF token

#### 5. `adapters/driven/drizzle/transaction.repository.ts` [L111-119]

[`services/domain/transactions/adapters/driven/drizzle/transaction.repository.ts`](./adapters/driven/drizzle/transaction.repository.ts)

- Implementasi `TransactionRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Query dasar dengan filter `userId`, `id`, `type`, dan rentang tanggal
- Mapping kolom database (`amount` dan `capital` disimpan sebagai string "ISO CODE VALUE", `paymentMethod` sebagai JSON)
- **`#toTransaction()`** — Helper untuk mapping row ke entity, parse `amount`/`capital` ke `Balance`

#### 6. `adapters/driving/graphql/transaction.gql` [L120-124]

- **Query**: `transaction(id)`, `transactions`, `transactionsByType(type)`, `transactionsByDateRange(start, end)`
- **Mutation**: `createTransaction(input)`, `updateTransaction(id, input)`, `deleteTransaction(id)`

#### 7. `adapters/driving/graphql/transaction.resolver.ts` [L125-133]

[`services/domain/transactions/adapters/driving/graphql/transaction.resolver.ts`](./adapters/driving/graphql/transaction.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `TransactionService`
- `mapTx()` — Helper untuk mapping Transaction entity ke GraphQL response shape
- Transformasi `Balance` → string ("IDR 100"), konversi `ID` → `toHash`
- Validasi `userAuth` di setiap resolver

#### 8. `transaction.composition.ts` [L134-140]

[`services/domain/transactions/transaction.composition.ts`](./transactions.composition.ts)

- **Wiring**: Inisialisasi `TransactionRepositoryImpl` + `TransactionService.getInstance()`
- Export singleton `transactionService`

#### 9. `index.ts` [L141-148]

[`services/domain/transactions/index.ts`](./index.ts)

- Export `transactionService`

---

### Use Cases [L149-309]

#### `createTransaction(input)` — Buat transaksi baru [L151-167]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 52:62)

```ts
async createTransaction(input: TransactionInput): Promise<TransactionType>
```

    > `Transaction.new(input).validateAll()`
    >
    > > validasi gagal → `Error`
    > > validasi berhasil → `txRepo.save(tx)`
    > > `tx.id` undefined → `Error` ("no id returned")
    > > `tx.id` defined → `return tx`

---

#### `transaction(id, userId)` — Ambil transaksi by ID [L168-182]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 65:72)

```ts
async transaction(id: ID, userId: ID): Promise<TransactionType>
```

    > `txRepo.findById(id.toNumb, userId)`
    >
    > > `null` → `NotFoundError`
    > > `Transaction` → `return Transaction`

---

#### `transactions(userId)` — Ambil semua transaksi user [L183-196]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 75:77)

```ts
async transactions(userId: ID): Promise<TransactionType[]>
```

    > `txRepo.findAll(userId)`
    >
    > > `return Transaction[]`

---

#### `transactionsByType(type, userId)` — Ambil transaksi by tipe [L197-210]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 80:82)

```ts
async transactionsByType(type: string, userId: ID): Promise<TransactionType[]>
```

    > `txRepo.findByType(type, userId)`
    >
    > > `return Transaction[]`

---

#### `transactionsByDateRange(start, end, userId)` — Ambil transaksi by rentang tanggal [L211-224]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 84:86)

```ts
async transactionsByDateRange(start: Date, end: Date, userId: ID): Promise<TransactionType[]>
```

    > `txRepo.findByDateRange(start, end, userId)`
    >
    > > `return Transaction[]`

---

#### `updateTransaction(id, data, userId)` — Update transaksi [L225-243]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 89:107)

```ts
async updateTransaction(id: ID, data: TransactionUpdateData, userId: ID): Promise<TransactionType>
```

    > `transaction(id, userId)` — validasi eksistensi
    >
    > > `NotFoundError`
    > > `Transaction` ditemukan
    > > update field yang diberikan
    > > `existing.validateAll()`
    > > `txRepo.update(existing, userId)`
    > > `return Transaction`

---

#### `deleteTransaction(id, userId)` — Hapus transaksi [L244-259]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 110:116)

```ts
async deleteTransaction(id: ID, userId: ID): Promise<void>
```

    > `transaction(id, userId)` — validasi eksistensi
    >
    > > `idTx` undefined → `Error` ("Not Found")
    > > `idTx` defined → `txRepo.delete(idTx.toNumb, userId)`
    > > `return void`

---

#### `requestFormTransaction(userId)` — Generate hash form untuk CSRF [L260-275]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 131:138)

```ts
async requestFormTransaction(userId: ID): Promise<string>
```

    > generate random 5 digit number
    >
    > > `PasswordUtils.hash(rId)` — hash random number
    > > cache.set(userId.toHash, hash)
    > > `return hash`

---

#### `validateCSRFToken(token, userId)` — Validasi CSRF token [L276-294]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 151:170)

```ts
async validateCSRFToken(token: string, userId: ID): Promise<void>
```

    > `csrfCache.get(token)`
    >
    > > `null` → `NotFoundError` ("CSRF token invalid or expired")
    > > `stored` ditemukan → delete token from cache
    > > `stored.userId !== userId.toHash` → `NotFoundError`
    > > `CsrfToken.sign(randBytes)` → compare dengan token
    > > mismatch → `NotFoundError` ("CSRF token verification failed")
    > > match → `return void`

---

#### `requestFormCSRFToken(userId)` — Generate CSRF token [L295-309]

[`services/domain/transactions/app/use-cases/transaction.service.ts`](./app/use-cases/transaction.service.ts)(line 172:178)

```ts
async requestFormCSRFToken(userId: ID): Promise<string>
```

    > `CsrfToken.generate()` → generate token + randHex
    >
    > > csrfCache.set(token, { userId: userId.toHash, randHex })
    > > `return token`

---

### Alur Kerja (Data Flow) [L310-355]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (transaction.gql → transaction.resolver.ts)                  │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { transaction, userAuth }                  │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil TransactionService (use case layer)          │
│    transaction.resolver.ts → transaction.service.ts              │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. TransactionService jalankan business logic:                  │
│    - Validasi input (Zod schema di entity)                      │
│    - Parse Balance dari string "ISO CODE VALUE"                 │
│    - CSRF protection untuk form transaction                      │
│    - Panggil repository interface                                │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. TransactionRepositoryImpl (driven adapter) eksekusi DB query │
│    - Drizzle ORM → SQLite D1                                    │
│    - amount/capital disimpan sebagai string                      │
│    - paymentMethod disimpan sebagai JSON                         │
│    - Mapping row → Transaction entity                            │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                 │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain [L356-378]

Transaction module menjadi **pusat pencatatan** untuk semua aktivitas keuangan:

```text
AssetService.mutateAddAsset() / mutateSubtractAsset() / swapBalance()
    │
    └──→► TransactionService.createTransaction()  ← Module TRANSACTIONS
            └──→ catat mutasi asset sebagai transaksi

OrderService.createOrderProductSale() / createOrderExpense() / createOrderLoan()
    │
    └──→► TransactionService.createTransaction()  ← Module TRANSACTIONS
            └──→ catat order sebagai transaksi

StatisticRepositoryImpl.getStatistic()
    │
    └──→► transactionTable + assetTable           ← Module TRANSACTIONS + ASSETS
            └──→ agregasi data untuk statistik
```

---

### Catatan Arsitektur [L379-387]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `transaction.composition.ts` — singleton diinisialisasi saat app startup
- **Balance Storage**: `amount` dan `capital` disimpan sebagai string format "ISO CODE VALUE" (misal: "IDR 100000") di database
- **PaymentMethod Storage**: Disimpan sebagai JSON string di database
- **CSRF Protection**: Method `requestFormTransaction`, `validateCSRFToken`, dan `requestFormCSRFToken` untuk proteksi form transaksi
- **Cross-module integration**: Dipanggil oleh module lain (AssetService, OrderService) untuk pencatatan transaksi
