## Statistic Module — Penjelasan & Alur Kerja [L1-201]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **statistik/keuangan** user dalam sistem. Module ini bertanggung jawab atas perhitungan total income, expense, profit, loan, cash, dan total asset berdasarkan data transaksi dan asset yang dimiliki user.

---

### Struktur Direktori & File [L9-38]

```text
services/domain/statistic/
├── app/
│   └── statistic_service.ts           # Application service (orchestrasi use case)
├── core/
│   ├── model/
│   │   └── statistic.model.ts         # Model bisnis (data + behavior)
│   ├── usecase/
│   │   └── *.usecase.ts              # Use-case bisnis
│   ├── value-objects/
│   │   └── logger.ts                 # Logger khusus module
│   └── ports/out/
│       └── statistic-repository.port.ts   # Abstract port (repository contract)
├── adapters/
│   ├── driving/
│   │   └── graphql/
│   │       ├── statistic.gql          # SDL GraphQL
│   │       └── statistic.resolver.ts  # Resolvers GraphQL
│   └── driven/
│       └── drizzle/
│           ├── statistic.entity.ts    # Drizzle schema + Zod + Entity (persistence)
│           └── statistic.repository.ts    # Implementasi repository
└── statistic.composition.ts           # Composition root: Service.getInstance(new RepoImpl())
```

---

### Penjelasan File Per-File [L39-112]

#### 1. `adapters/driven/drizzle/statistic.entity.ts` [L41-53]

[`services/domain/statistic/adapters/driven/drizzle/statistic.entity.ts`](./adapters/driven/drizzle/statistic.entity.ts)

- **`StatisticData` type** — Type definition untuk data statistik:
  - `totalIncome`: number — total income dari transaksi
  - `totalExpense`: number — total expense dari transaksi
  - `totalProfit`: number — total profit (income - capital, excluding "Add Balance")
  - `totalLoan`: number — total loan dari asset tipe loan
  - `totalCash`: number — total cash dari asset tipe cash
  - `totalAsset`: number — total asset (semua asset + totalProfit)
- Tidak ada class entity, hanya type definition karena statistik adalah data agregat (computed dari module lain)

#### 2. `core/value-objects/logger.ts` [L54-57]

- Membuat instance logger khusus untuk `StatisticService` dengan prefix `"StatisticService"` dan file log `statistic-service-log.log`

#### 3. `core/ports/out/statistic-repository.port.ts` [L58-64]

[`services/domain/statistic/core/ports/out/statistic-repository.port.ts`](./core/ports/out/statistic-repository.port.ts)

- **Abstract class `StatisticRepository`** — Port (out) yang mendefinisikan kontrak repository. StatisticService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/statistic.repository.ts`. Method bersifat `abstract` (wajib diimplementasi adapter).

  **Daftar Method:**

  1. **`getStatistic(userId)`** — Hitung statistik keuangan user (agregasi dari data transaksi/order)
     - Parameter:
       - `userId: number`
     - Return: `Promise<StatisticData>` — hasil agregasi statistik (read-only, tidak ada method mutasi)

#### 4. `core/usecase/statistic.service.ts` [L65-72]

[`services/domain/statistic/app/use-cases/statistic.service.ts`](./app/use-cases/statistic.service.ts)

- **Singleton pattern** — `StatisticService.getInstance()`
- **Use cases:**
  - `getStatistic(userId)` — Ambil statistik keuangan user

#### 5. `adapters/driven/drizzle/statistic.repository.ts` [L73-86]

[`services/domain/statistic/adapters/driven/drizzle/statistic.repository.ts`](./adapters/driven/drizzle/statistic.repository.ts)

- Implementasi `StatisticRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- `getStatistic` — Query ke tabel `transaction` dan `asset`, lalu hitung agregat:
  - `totalIncome` — sum amount dari transaksi tipe `income`
  - `totalExpense` — sum amount dari transaksi tipe `expense`
  - `totalProfit` — sum (amount - capital) yang bukan kategori "Add Balance"
  - `totalLoan` — sum balance dari asset tipe `loan`
  - `totalCash` — sum balance dari asset tipe `cash`
  - `totalAsset` — sum balance semua asset + totalProfit
- **`parseAmountValue()`** — Helper untuk parse string amount ("IDR 100") ke number

#### 6. `adapters/driving/graphql/statistic.gql` [L87-90]

- **Query**: `statistics` — ambil statistik user yang login

#### 7. `adapters/driving/graphql/statistic.resolver.ts` [L91-97]

[`services/domain/statistic/adapters/driving/graphql/statistic.resolver.ts`](./adapters/driving/graphql/statistic.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `StatisticService`
- Panggil `statistic.getStatistic(userAuth.id.toNumb)` dan return data

#### 8. `statistic.composition.ts` [L98-104]

[`services/domain/statistic/statistic.composition.ts`](./statistic.composition.ts)

- **Wiring**: Inisialisasi `StatisticRepositoryImpl` + `StatisticService.getInstance()`
- Export singleton `statisticService`

#### 9. `index.ts` [L105-112]

[`services/domain/statistic/index.ts`](./index.ts)

- Export `statisticService`

---

### Use Cases [L113-136]

#### `getStatistic(userId)` — Ambil statistik keuangan user [L115-136]

[`services/domain/statistic/app/use-cases/statistic.service.ts`](./app/use-cases/statistic.service.ts)(line 22:24)

```ts
async getStatistic(userId: number): Promise<StatisticData>
```

    > `statisticRepo.getStatistic(userId)`
    >
    > > query `transactionTable` where `userId = userId`
    > > query `assetTable` where `userId = userId`
    > > hitung `totalIncome` dari transaksi `income`
    > > hitung `totalExpense` dari transaksi `expense`
    > > hitung `totalProfit` dari transaksi `income` excluding category "Add Balance"
    > > hitung `totalLoan` dari asset tipe `loan`
    > > hitung `totalCash` dari asset tipe `cash`
    > > hitung `totalAsset` dari semua asset + totalProfit
    > > `return StatisticData`

---

### Alur Kerja (Data Flow) [L137-178]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (statistic.gql → statistic.resolver.ts)                      │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { statistic, userAuth }                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil StatisticService (use case layer)           │
│    statistic.resolver.ts → statistic.service.ts                 │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. StatisticService.getStatistic(userId)                        │
│    - Delegasi ke repository untuk hitung agregat                │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. StatisticRepositoryImpl eksekusi query agregat               │
│    - Query transaction + asset                                   │
│    - Hitung totalIncome, totalExpense, totalProfit              │
│    - Hitung totalLoan, totalCash, totalAsset                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Integrasi dengan Module Lain [L179-194]

Statistic module adalah **reader** dari data module lain:

```text
StatisticRepositoryImpl.getStatistic()
    │
    ├──► transactionTable              ← Module TRANSACTIONS
    │       └──→ ambil semua transaksi user untuk hitung income/expense/profit
    │
    └──→► assetTable                    ← Module ASSETS
            └──→ ambil semua asset user untuk hitung loan/cash/total asset
```

---

### Catatan Arsitektur [L195-201]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `statistic.composition.ts` — singleton diinisialisasi saat app startup
- **Computed Data**: Statistik adalah data agregat yang dihitung langsung dari tabel transaction dan asset (tanpa tabel tersendiri)
- **Cross-module read**: Membaca data dari module transactions dan assets untuk komputasi
