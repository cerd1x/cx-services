## Order Module — Penjelasan & Alur Kerja [L1-378]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **order/pesanan** dalam sistem. Module ini bertanggung jawab atas manajemen order umum, order penjualan produk, order pengeluaran (expense), order pinjaman (loan), dan integrasi dengan transaksi serta asset untuk tracking keuangan.

---

### Struktur Direktori & File [L9-38]

```text
domain/order/
├── core/
│   ├── model/
│   │   ├── index.ts
│   │   └── order.model.ts
│   ├── ports/
│   │   └── out/
│   │       └── order-repository.port.ts
│   ├── usecase/
│   │   ├── create-order-expense.usecase.ts
│   │   ├── create-order-loan.usecase.ts
│   │   ├── create-order-product-sale.usecase.ts
│   │   ├── create-order.usecase.ts
│   │   ├── delete-order.usecase.ts
│   │   ├── list-orders.usecase.ts
│   │   ├── order-by-id.usecase.ts
│   │   ├── orders-by-date-range.usecase.ts
│   │   ├── payment-service.ctx.ts
│   │   └── update-order.usecase.ts
│   └── value-objects/
│       └── logger.ts
├── adapters/
│   ├── driven/
│   │   └── drizzle/
│   │       └── order.repository.ts
│   └── driving/
│       └── graphql/
│           ├── order.gql
│           └── order.resolver.ts
├── index.ts
└── order.composition.ts
```

---

### Penjelasan File Per-File [L39-140]

#### 1. `core/model/order.model.ts` [L41-75]

[`core/model/order.model.ts`](core/model/order.model.ts)

- **`orderSchema`** — Zod schema (`z.object({...})`)
  - **Fields:**
    1. `id`: `z.number().optional()` — auto-generated
    2. `userId`: `z.number().optional()`
    3. `status`: `z.enum(["pending", "success", "cancelled"]).default("pending")` — required
    4. `paymentMethod`: `z.enum(["cash", "bank_transfer", "ewallet", "credit_card", "debit_card", "credit"]).default("cash")` — required
    5. `price`: `z.number().positive()` — required, harga per item
    6. `totalAmount`: `z.number().optional()` — total amount (price * itemCount), dihitung otomatis
    7. `currency`: `z.string().length(3).toUpperCase()` — required, 3-letter ISO code
    8. `itemCount`: `z.number().int().positive()` — required, jumlah item
    9. `description`: `z.string().max(500).optional()`
    10. `customerId`: `z.number().optional()` — ID customer (untuk order expense/loan)
    11. `createdAt`: `z.date().optional()`
    12. `updatedAt`: `z.date().optional()`
- **`OrderType`** — `z.infer<typeof orderSchema>` (type alias)
- **`OrderStatus`** — Enum: `pending`, `success`, `cancelled`
- **`PaymentMethod`** — Diambil dari module transactions (`paymentMethodSchema`)
- **`Order` class** — Entity dengan properti dan method validasi
  - **Properties:** `id`, `userId`, `status`, `paymentMethod`, `price`, `totalAmount`, `currency`, `itemCount`, `description`, `customerId`, `createdAt`, `updatedAt`
  - **`constructor(data)`** — Menerima object `{ price, currency, itemCount, userId?, status?, paymentMethod?, description?, customerId?, id?, createdAt?, updatedAt? }`. `totalAmount` dihitung otomatis dari `price * itemCount`
  - **`static new(data)`** — Factory method, shortcut ke `new Order(data)`
  - **`getTotalAmount()`** — Menghitung `price * itemCount`
  - **Validation methods (chainable, return `this`):**
    1. `validateStatus()` — `statusSchema.safeParse(this.status)`
    2. `validatePaymentMethod()` — `paymentMethodSchema.safeParse(this.paymentMethod)`
    3. `validatePrice()` — `priceSchema.safeParse(this.price)`
    4. `validateCurrency()` — `currencySchema.safeParse(this.currency)`
    5. `validateItemCount()` — `itemCountSchema.safeParse(this.itemCount)`
    6. `validateDescription()` — `descriptionSchema.safeParse(this.description)` (skip if undefined)
    7. `validateAll()` — Chain semua method di atas

#### 2. `core/value-objects/logger.ts` [L76-79]

- Membuat instance logger khusus untuk `OrderService` dengan prefix `"OrderService"` dan file log `order-service-log.log`

#### 3. `core/ports/out/order-repository.port.ts` [L80-85]

[`services/domain/order/core/ports/out/order-repository.port.ts`](./core/ports/out/order-repository.port.ts)

- **Abstract class `OrderRepository`** — Port (out) yang mendefinisikan kontrak repository. OrderService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/order.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter).

  **Daftar Method:**

  1. **`save(order)`** — Insert order baru
     - Parameter:
       - `order: Order` — entity Order lengkap
     - Return: `Promise<Order>` — entity Order yang tersimpan

  2. **`findById(id, userId)`** — Cari order by ID + pemilik
     - Parameter:
       - `id: number` — ID order
       - `userId: number` — pemilik order
     - Return: `Promise<Order | null>` — `null` jika tidak ditemukan

  3. **`findAll(userId)`** — Ambil semua order milik user
     - Parameter:
       - `userId: number` — pemilik order
     - Return: `Promise<Order[]>` — selalu array (kosong `[]` jika tidak ada)

  4. **`findAllByDateRange(start, end, userId)`** — Ambil order dalam rentang tanggal
     - Parameter:
       - `start: Date` — batas awal (inklusif)
       - `end: Date` — batas akhir
       - `userId: number` — pemilik order
     - Return: `Promise<Order[]>`

  5. **`update(order, userId)`** — Update order existing
     - Parameter:
       - `order: Order` — entity Order dengan data baru
       - `userId: number` — pemilik order (guard akses)
     - Return: `Promise<Order>` — entity Order hasil update

  6. **`delete(id, userId)`** — Hapus order by ID + pemilik
     - Parameter:
       - `id: number` — ID order
       - `userId: number` — pemilik order
     - Return: `Promise<void>` — tidak mengembalikan apa pun

#### 4. `core/usecase/order.service.ts` [L86-101]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)

- **Singleton pattern** — `OrderService.getInstance()`
- **Use cases:**
  - `createOrderProductSale` — Buat order penjualan produk (integrasi dengan ProductService, TransactionService, AssetService)
  - `createOrderExpense` — Buat order pengeluaran (integrasi dengan TransactionService, AssetService)
  - `createOrderLoan` — Buat order pinjaman (integrasi dengan TransactionService, AssetService)
  - `createOrder` — Buat order umum
  - `order` — Ambil order by ID
  - `orders` — Ambil semua order user
  - `ordersByDateRange` — Ambil order berdasarkan rentang tanggal
  - `updateOrder` — Update order
  - `deleteOrder` — Hapus order

#### 5. `adapters/driven/drizzle/order.repository.ts` [L102-110]

[`services/domain/order/adapters/driven/drizzle/order.repository.ts`](./adapters/driven/drizzle/order.repository.ts)

- Implementasi `OrderRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Query dasar dengan filter `userId` dan `id`
- Mapping kolom database (`paymentMethod` sebagai JSON, `totalAmount`, `itemCount`)
- Method `#toOrder()` helper untuk mapping row ke entity

#### 6. `adapters/driving/graphql/order.gql` [L111-115]

- **Query**: `order(id)`, `orders`
- **Mutation**: `createOrder`, `updateOrder`, `deleteOrder`, `createOrderProductSale`, `createOrderExpense`, `createOrderLoan`

#### 7. `adapters/driving/graphql/order.resolver.ts` [L116-125]

[`services/domain/order/adapters/driving/graphql/order.resolver.ts`](./adapters/driving/graphql/order.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `OrderService`
- Transformasi hasil dari entity ke GraphQL response shape
- Konversi `ID` → `toHash` untuk response
- `mapPaymentMethod()` — validasi payment method type
- `mapTx()` — helper untuk mapping Transaction entity ke GraphQL response shape

#### 8. `order.composition.ts` [L126-132]

[`services/domain/order/order.composition.ts`](./order.composition.ts)

- **Wiring**: Inisialisasi `OrderRepositoryImpl` + `OrderService.getInstance()`
- Export singleton `orderService`

#### 9. `index.ts` [L133-140]

[`services/domain/order/index.ts`](./index.ts)

- Export `orderService` dan `OrderType`

---

### Use Cases [L141-289]

#### `createOrderProductSale(data)` — Buat order penjualan produk [L143-179]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 34:155)

```text
ProductService.getInstance().product(data.productId)
    ├── product.userId !== data.userId
    │    └──→ Error: "Product does not belong to this user"
    ├── product.trackStock === true
    |    └──→ product.stock < data.itemCount
    │     └──→ Error: "Insufficient stock"
    └──→ product.trackStock === false
          └──→ Skip pengecekan stok
TransactionService.getInstance().createTransaction()
    └──→ savedTxId = createdTx.id
ProductService.getInstance().updateProduct()
    └──→ kurangi stok
AssetService.getInstance().mutateAddAsset()
    └──→ tambah asset
Order.new(...).validateAll()
    └──→ orderRepo.save(order)
            ├── order.id undefined → Error
            └──→ order.id defined → return order
catch → rollback:
    ├── delete transaction
    ├── subtract asset
    └──→ restore stock

```

#### `createOrderExpense(data)` — Buat order pengeluaran [L180-200]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 158:243)

```text
TransactionService.getInstance().createTransaction()
    └──→ savedTxId = createdTx.id

AssetService.getInstance().mutateSubtractAsset()
    └──→ kurangi asset

Order.new(...).validateAll()
    └──→ orderRepo.save(order)
            ├── order.id undefined → Error
            └──→ order.id defined → return order

catch → rollback:
    ├── delete transaction
    └──→ add back asset
```

#### `createOrderLoan(data)` — Buat order pinjaman [L201-222]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 246:331)

```text
TransactionService.getInstance().createTransaction()
    └──→ savedTxId = createdTx.id
    └──→ category: "Loan"

AssetService.getInstance().mutateSubtractAsset()
    └──→ kurangi asset

Order.new(...).validateAll()
    └──→ orderRepo.save(order)
            ├── order.id undefined → Error
            └──→ order.id defined → return order

catch → rollback:
    ├── delete transaction
    └──→ add back asset
```

#### `createOrder(data)` — Buat order umum [L223-233]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 334:351)

```text
Order.new({ ...data }).validateAll()
    └──→ orderRepo.save(order)
            ├── order.id undefined → Error
            └──→ order.id defined → return order
```

#### `order(id, userId)` — Ambil order by ID [L234-243]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 354:362)

```text
orderRepo.findById(id.toNumb, userId.toNumb)
    ├── null → NotFoundError
    └──→ Order → return Order
```

#### `orders(userId)` — Ambil semua order user [L244-252]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 365:367)

```text
orderRepo.findAll(userId.toNumb)
    └──→ return Order[]
```

#### `ordersByDateRange(start, end, userId)` — Ambil order by rentang tanggal [L253-261]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 370:372)

```text
orderRepo.findAllByDateRange(start, end, userId.toNumb)
    └──→ return Order[]
```

#### `updateOrder(id, data, userId)` — Update order [L262-275]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 375:395)

```text
order(id, userId) — validasi eksistensi
    ├── NotFoundError
    └──→ Order ditemukan
            └──→ update field yang diberikan
                    └──→ existing.validateAll()
                            └──→ orderRepo.update(existing, userId.toNumb)
                                    └──→ return Order
```

#### `deleteOrder(id, userId)` — Hapus order [L276-289]

[`services/domain/order/app/use-cases/order.service.ts`](./app/use-cases/order.service.ts)(line 398:401)

```text
order(id, userId) — validasi eksistensi
    ├── NotFoundError
    └──→ Order ditemukan
            └──→ orderRepo.delete(id.toNumb, userId.toNumb)
                    └──→ return void
```

---

### Alur Kerja (Data Flow) [L290-334]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (order.gql → order.resolver.ts)                              │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { order, userAuth }                       │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil OrderService (use case layer)              │
│    order.resolver.ts → order.service.ts                         │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. OrderService jalankan business logic:                       │
│    - Validasi input (Zod schema di entity)                      │
│    - Integrasi dengan ProductService (cek stok)                │
│    - Integrasi dengan TransactionService (catat transaksi)     │
│    - Integrasi dengan AssetService (mutasi asset)              │
│    - Rollback manual jika gagal                                 │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. OrderRepositoryImpl (driven adapter) eksekusi DB query      │
│    - Drizzle ORM → SQLite D1                                    │
│    - Mapping row → Order entity                                 │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain [L335-370]

Order module menjadi **pusat integrasi** untuk bisnis transaksi:

```text
createOrderProductSale
    │
    ├──► ProductService.product()     ← Module PRODUCTS
    │       └──→ cek ownership + stok
    │
    ├──► ProductService.updateProduct() ← Module PRODUCTS
    │       └──→ kurangi stok
    │
    ├──► TransactionService.createTransaction() ← Module TRANSACTIONS
    │       └──→ catat income
    │
    ├──► AssetService.mutateAddAsset() ← Module ASSETS
    │       └──→ tambah saldo asset
    │
    └──→► OrderRepository.save()        ← Module ORDER
            └──→ simpan order

createOrderExpense / createOrderLoan
    │
    ├──► TransactionService.createTransaction() ← Module TRANSACTIONS
    │       └──→ catat expense/loan
    │
    ├──► AssetService.mutateSubtractAsset() ← Module ASSETS
    │       └──→ kurangi saldo asset
    │
    └──→► OrderRepository.save()        ← Module ORDER
            └──→ simpan order
```

---

### Catatan Arsitektur [L371-378]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `order.composition.ts` — singleton diinisialisasi saat app startup
- **Cross-module integration**: Bergantung pada `ProductService`, `TransactionService`, dan `AssetService`
- **Rollback Pattern**: Menggunakan try-catch dengan rollback manual (delete transaction, reverse asset mutation, restore stock) untuk konsistensi data
- **Payment Method**: Menggunakan `PaymentMethod` dari module transactions (type + assetId)
