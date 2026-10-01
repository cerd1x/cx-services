## Products Module — Penjelasan & Alur Kerja [L1-257]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **produk** dalam sistem. Module ini bertanggung jawab atas manajemen produk (CRUD), import produk dari file CSV, dan tracking stok serta margin keuangan produk.

---

### Struktur Direktori & File [L9-38]

```text
domain/products/
├── core/
│   ├── entity/
│   │   └── product.entity.ts
│   ├── model/
│   │   ├── index.ts
│   │   └── product.model.ts
│   ├── ports/
│   │   └── out/
│   │       └── product-repository.port.ts
│   ├── usecase/
│   │   ├── buy-product.usecase.ts
│   │   ├── create-product.usecase.ts
│   │   ├── delete-product.usecase.ts
│   │   ├── import-products-from-file.usecase.ts
│   │   ├── list-products.usecase.ts
│   │   ├── product-by-id.usecase.ts
│   │   └── update-product.usecase.ts
│   └── value-objects/
│       └── logger.ts
├── adapters/
│   ├── driven/
│   │   └── drizzle/
│   │       └── product.repository.ts
│   └── driving/
│       └── graphql/
│           ├── product.gql
│           └── product.resolver.ts
├── index.ts
└── products.composition.ts
```

---

### Penjelasan File Per-File [L39-119]

#### 1. `core/entity/product.entity.ts` [L41-72]

[`core/entity/product.entity.ts`](core/entity/product.entity.ts)

- **`productSchema`** — Zod schema (`z.object({...})`)
  - **Fields:**
    1. `id`: `z.number().optional()` — auto-generated
    2. `userId`: `z.number().optional()`
    3. `name`: `z.string().min(1).max(200)` — required
    4. `description`: `z.string().max(1000).optional()`
    5. `price`: `z.number().positive()` — required, harga jual
    6. `capital`: `z.number().nonnegative().optional()` — modal
    7. `currency`: `z.string().length(3).toUpperCase()` — required, 3-letter code
    8. `stock`: `z.number().int().nonnegative()` — required
    9. `trackStock`: `z.boolean().default(true)` — mode stok: `true` = track stok (validasi & pengurangan stok saat penjualan), `false` = tanpa stok (unlimited, validasi stok dilewati)
    10. `createdAt`: `z.date().optional()`
    11. `updatedAt`: `z.date().optional()`
- **`ProductType`** — `z.infer<typeof productSchema>` (type alias)
- **`Product` class** — Entity dengan properti dan method validasi
  - **Properties:** `id`, `userId`, `name`, `description`, `price`, `capital`, `currency`, `stock`, `createdAt`, `updatedAt`
  - **`constructor(data)`** — Menerima object `{ name, userId?, description?, price, capital?, currency, stock?, id?, createdAt?, updatedAt? }`. Set `id` via `ID.new(data.id)`, `stock` default `0`
  - **`static new(data)`** — Factory method, shortcut ke `new Product(data)`. Menerima `{ name, userId?, price, capital?, currency, description?, stock? }`
  - **`margin` getter** — Menghitung `price - capital`. Returns `0` jika `capital === undefined`
  - **Validation methods (chainable, return `this`):**
    1. `validateName()` — `nameSchema.safeParse(this.name)`
    2. `validateDescription()` — `descriptionSchema.safeParse(this.description)` (skip if undefined)
    3. `validatePrice()` — `priceSchema.safeParse(this.price)`
    4. `validateCapital()` — `capitalSchema.safeParse(this.capital)` (skip if undefined)
    5. `validateCurrency()` — `currencySchema.safeParse(this.currency)`
    6. `validateStock()` — `stockSchema.safeParse(this.stock)` (skip if undefined)
    7. `validateAll()` — Chain semua method di atas

#### 2. `core/value-objects/logger.ts` [L73-76]

- Membuat instance logger khusus untuk `ProductService` dengan prefix `"ProductService"` dan file log `product-service-log.log`

#### 3. `core/ports/out/product-repository.port.ts` [L77-80]

- **Abstract class `ProductRepository`** — Port (out) yang mendefinisikan kontrak repository. ProductService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/product.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter).

  **Daftar Method:**

  1. **`save(product)`** — Insert product baru
     - Parameter:
       - `product: Product` — entity Product lengkap
     - Return: `Promise<Product>` — entity Product yang tersimpan

  2. **`findById(id, userId)`** — Cari product by ID + pemilik
     - Parameter:
       - `id: number` — ID product
       - `userId: number` — pemilik product
     - Return: `Promise<Product | null>` — `null` jika tidak ditemukan

  3. **`findAll()`** — Ambil semua product (global, semua user)
     - Parameter: tidak ada
     - Return: `Promise<Product[]>`
     - Catatan: satu-satunya method query tanpa filter userId

  4. **`findAllByUserId(userId)`** — Ambil semua product milik user
     - Parameter:
       - `userId: number` — pemilik product
     - Return: `Promise<Product[]>`

  5. **`update(product, userId)`** — Update product existing
     - Parameter:
       - `product: Product` — entity Product dengan data baru
       - `userId: number` — pemilik product (guard akses)
     - Return: `Promise<Product>` — entity Product hasil update

  6. **`delete(id, userId)`** — Hapus product by ID + pemilik
     - Parameter:
       - `id: number` — ID product
       - `userId: number` — pemilik product
     - Return: `Promise<void>` — tidak mengembalikan apa pun

#### 4. `core/usecase/product_service.ts` [L81-91]

- **Singleton pattern** — `ProductService.getInstance()`
- **Use cases**:
  - `createProduct` — Buat produk baru
  - `product` — Ambil produk by ID
  - `products` — Ambil semua produk milik user
  - `updateProduct` — Update produk
  - `deleteProduct` — Hapus produk
  - `importFromFile` — Import produk dari file CSV dengan merge logic

#### 5. `adapters/driven/drizzle/product.repository.ts` [L92-97]

- Implementasi `ProductRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Query dasar dengan filter `id` dan `userId`
- Mapping kolom database (`capital` nullable, `description` nullable)

#### 6. `adapters/driving/graphql/product.gql` [L98-102]

- **Query**: `product(id)`, `products`
- **Mutation**: `createProduct(input)`, `updateProduct(id, input)`, `deleteProduct(id)`, `importProductFromCSV(content, filename)`

#### 7. `adapters/driving/graphql/product.resolver.ts` [L103-108]

- Resolver yang menghubungkan GraphQL schema ke `ProductService`
- Transformasi hasil dari entity ke GraphQL response shape
- Konversi `ID` → `toHash` untuk response

#### 8. `product.composition.ts` [L109-113]

- **Wiring**: Inisialisasi `ProductRepositoryImpl` + `ProductService.getInstance()`
- Export singleton `productService`

#### 9. `index.ts` [L114-119]

- Export `productService` dan `ProductType`

---

### Use cases [L120-187]

- [createProduct](services/domain/products/app/use-cases/product_service.ts)(line 30:55) Buat produk baru

```ts
 async createProduct(
    userId: number,
    name: string,
    price: number,
    currency: string,
    description?: string,
    stock?: number,
    capital?: number,
  ): Promise<ProductType>
```

    > `Product.new({ userId, name, price, capital, currency, description, stock }).validateAll()`
    >
    > > validasi gagal → `Error`
    > > validasi berhasil → `productRepo.save(product)`
    > > `product.id` undefined → `Error` ("no id returned")
    > > `product.id` defined → `return product`

---

- `product(id)` — Ambil produk by ID
  > `productRepo.findById(id.toNumb)`
  >
  > > `null` → `NotFoundError`
  > > `Product` → `return Product`
  ***
- `products(userId)` — Ambil semua produk user
  > `productRepo.findAllByUserId(userId)`
  >
  > > `return Product[]`
  ***
- `updateProduct(id, data)` — Update produk
  > `product(id)` — validasi eksistensi
  >
  > > `NotFoundError`
  > > `Product` ditemukan
  > > update field yang diberikan
  > > `existing.validateAll()`
  > > `productRepo.update(existing)`
  > > `return Product`
  ***
- `deleteProduct(id)` — Hapus produk
  > `product(id)` — validasi eksistensi
  >
  > > `NotFoundError`
  > > `Product` ditemukan → `productRepo.delete(id.toNumb)`
  > > `return void`
  ***
- `importFromFile(userId, file)` — Import produk dari file CSV
  > `file.text()` → baca file
  >
  > > `parseProductCSV(text)` → parse CSV ke array of product data
  > > `productRepo.findAllByUserId(userId)` — ambil produk existing
  > > buat `existingMap` dari nama produk
  > > loop setiap produk dari file
  > > `item.name` kosong → `failed++`, continue
  > > `existing` ditemukan → merge field yang berubah → `productRepo.update()` → `merged++`
  > > `existing` tidak ditemukan → `createProduct()` → `imported++`
  > > `catch` → `failed++`
  > > `return { imported, failed, merged }`

---

### Alur Kerja (Data Flow) [L188-231]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (product.gql → product.resolver.ts)                          │
└──→──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)        │
│    → inject context: { product, userAuth }                      │
└──→──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil ProductService (use case layer)              │
│    product.resolver.ts → product_service.ts                      │
└──→──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ProductService jalankan business logic:                      │
│    - Validasi input (Zod schema di entity)                       │
│    - Hitung margin (amount - capital)                            │
│    - Import file: parse CSV + merge logic                        │
│    - Panggil repository interface                                │
└──→──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ProductRepositoryImpl (driven adapter) eksekusi DB query      │
│    - Drizzle ORM → SQLite D1                                    │
│    - Mapping row → Product entity                                │
└──→──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                 │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain [L232-249]

Products module menjadi **sumber data** untuk order penjualan:

```text
OrderService.createOrderProductSale()
    │
    ├──► ProductService.product()        ← Module PRODUCTS
    │       └──→ cek ownership + stok + hitung capital
    │
    ├──► ProductService.updateProduct()  ← Module PRODUCTS
    │       └──→ kurangi stok
    │
    └──→► dilanjutkan ke TransactionService + AssetService + OrderRepo
```

---

### Catatan Arsitektur [L250-257]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `product.composition.ts` — singleton diinisialisasi saat app startup
- **File Import**: Mendukung import dari CSV dengan merge logic (update jika nama sama)
- **Margin Calculation**: `margin = amount - capital` dihitung otomatis dari entity
- **Cross-module dependency**: Depend on module lain untuk order (ProductService dipanggil oleh OrderService)
