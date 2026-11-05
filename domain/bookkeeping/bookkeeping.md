## Bookkeeping Module — Penjelasan & Alur Kerja

### Tujuan Module

Menyediakan **read model buku besar** (ledger) bulanan yang sebelumnya dihitung di
client `cx-dompetqu`. Module ini menggabungkan data dari module `transactions` dan
`payment`, lalu menghitung:

- ringkasan income/expense/profit per mata uang,
- saldo berjalan (running balance) per transaksi,
- pengelompokan transaksi per tanggal kalender lokal,
- daftar payment gagal beserta status retry.

Module ini **tidak punya tabel sendiri**. Semua data bersumber dari module lain;
bookkeeping hanya menyimpan aturan agregasi dan kontrak GraphQL yang stabil untuk
client.

---

### Struktur Direktori & File

```text
domain/bookkeeping/
├── core/
│   ├── model/
│   │   ├── index.ts
│   │   └── bookkeeping.model.ts
│   ├── ports/
│   │   └── out/
│   │       └── bookkeeping-source.port.ts
│   ├── usecase/
│   │   ├── get_bookkeeping_failed_payments.usecase.ts
│   │   └── get_bookkeeping_ledger.usecase.ts
│   └── value-objects/
│       └── logger.ts
├── adapters/
│   ├── driven/
│   │   └── services/
│   │       └── bookkeeping-source.adapter.ts
│   └── driving/
│       └── graphql/
│           ├── bookkeeping.gql
│           └── bookkeeping.resolver.ts
├── index.ts
└── bookkeeping.composition.ts
```

---

### Penjelasan File Per-File

#### 1. `core/model/bookkeeping.model.ts`

Seluruh aturan buku besar berada di model, bukan di resolver atau use case.

- **`BOOKKEEPING_FILTERS`** — `all`, `income`, `expense`, `transfer`, `outcome`.
  `outcome` disediakan karena `TransactionType` di module transactions juga memuat
  nilai tersebut, walaupun chip di `cx-dompetqu` belum memakainya.
- **`bookkeepingPeriodSchema`** — Validasi `{ month, timezoneOffsetMinutes }`.
  `month` wajib `YYYY-MM`; offset timezone dibatasi `-840..840` menit dan default `0`.
- **`BookkeepingTransactionData`** — Snapshot transaksi yang dibutuhkan ledger.
  Bentuk ini adalah kontrak anti-korupsi agar `core/` tidak bergantung pada entity
  module transactions.
- **`BookkeepingPaymentData`** — Snapshot payment gagal untuk tab Failed.
- **`BookkeepingPeriod`** — Value object periode:
  - `start` / `endExclusive` dihitung sebagai instant UTC dari bulan lokal pemanggil.
  - `contains(date)` memeriksa apakah sebuah instant masuk periode.
  - `localDateKey(date)` menghasilkan `YYYY-MM-DD` pada timezone pemanggil untuk
    pengelompokan harian.
- **`BookkeepingLedger`** — Model ledger satu bulan:
  - menyaring transaksi berdasarkan periode dan filter tipe,
  - menghitung ringkasan **per mata uang** (`income`, `expense`, `profit`,
    `transactionCount`),
  - menghitung saldo berjalan dari transaksi terlama ke terbaru, dimulai dari nol
    pada bulan/filter terpilih,
  - mengelompokkan transaksi per tanggal lokal, urut terbaru dulu; di dalam grup,
    transaksi juga terbaru dulu. `runningBalance` tetap mengikuti urutan kronologis.
- **`BookkeepingFailedPayments`** — Model tab Failed:
  - hanya menerima payment berstatus `failed` di periode terpilih,
  - mengurutkan terbaru dulu,
  - menghitung `totalCount` dan `retryableCount`
    (`retryCount < maxRetries`).

> Penting: `transfer` tidak menambah/mengurangi saldo berjalan maupun income/expense,
> tetapi tetap dihitung pada `transactionCount` dan tetap tampil di ledger.

#### 2. `core/ports/out/bookkeeping-source.port.ts`

Abstract class `BookkeepingSource` — port outbound untuk sumber data.

```ts
abstract listTransactions(userId, start, endExclusive): Promise<BookkeepingTransactionData[]>
abstract listFailedPayments(userId, start, endExclusive): Promise<BookkeepingPaymentData[]>
```

Use case hanya bergantung pada port ini, sehingga mudah diuji dengan mock.

#### 3. `core/usecase/get_bookkeeping_ledger.usecase.ts`

`GetBookkeepingLedgerUseCase`:

1. membangun `BookkeepingPeriod` dari input (validasi bulan + timezone),
2. memvalidasi filter (default `all`),
3. mengambil transaksi lewat `BookkeepingSource`,
4. menyerahkan transaksi ke `BookkeepingLedger.build`.

#### 4. `core/usecase/get_bookkeeping_failed_payments.usecase.ts`

`GetBookkeepingFailedPaymentsUseCase`:

1. membangun `BookkeepingPeriod`,
2. mengambil payment gagal lewat `BookkeepingSource`,
3. menyerahkan payment ke `BookkeepingFailedPayments.build`.

#### 5. `adapters/driven/services/bookkeeping-source.adapter.ts`

Implementasi produksi `BookkeepingSource`.

- `listTransactions` memanggil
  `TransactionService.transactionsByDateRange(start, endExclusive, userId)` lalu
  memetakan entity transaksi ke `BookkeepingTransactionData`.
- `listFailedPayments` memanggil
  `PaymentService.listPaymentsByStatus("failed", userId)`, memetakan amount ke
  `Money`, membaca `metadata.lastError`, lalu menyaring periode.
- Service di-resolve **saat method dipanggil** (`getInstance()`), bukan di
  constructor, untuk menghindari masalah urutan inisialisasi/circular import.

#### 6. `adapters/driving/graphql/bookkeeping.gql`

Mendefinisikan dua query utama dan tipe turunannya. Tipe `Transaction`, `Money`,
`PaymentMethodEnum`, dan `PaymentStatusEnum` di-reuse dari module lain.

#### 7. `adapters/driving/graphql/bookkeeping.resolver.ts`

Menghubungkan GraphQL ke `BookkeepingService`:

- memetakan ID numerik internal ke ID publik (`ID.transaction`, `ID.payment`,
  `ID.contact`, `ID.asset`),
- memetakan entity bookkeeping ke tipe GraphQL,
- `canRetry` diturunkan dari `retryCount < maxRetries`.

#### 8. `bookkeeping.composition.ts`

- `BookkeepingService` — singleton service dengan method `getLedger` dan
  `getFailedPayments`.
- `createBookkeepingService({ source })` — factory + DI container.
- `bookkeepingService` — singleton produksi dengan `BookkeepingSourceAdapter`.

#### 9. `index.ts`

Barrel export: service, factory, model/type publik, dan input use case. Module lain
hanya boleh mengimpor lewat pintu ini.

---

### GraphQL Contract

```graphql
type Query {
  bookkeepingLedger(input: BookkeepingLedgerInput!): BookkeepingLedger! @authorized
  bookkeepingFailedPayments(input: BookkeepingFailedPaymentsInput!): BookkeepingFailedPayments!
    @authorized
}

input BookkeepingLedgerInput {
  month: String! # YYYY-MM pada timezone pemanggil
  timezoneOffsetMinutes: Int # WIB = 420; default 0 (UTC)
  filter: BookkeepingFilter # default all
}

input BookkeepingFailedPaymentsInput {
  month: String!
  timezoneOffsetMinutes: Int
}
```

Contoh query:

```graphql
query Ledger($input: BookkeepingLedgerInput!) {
  bookkeepingLedger(input: $input) {
    month
    filter
    summaries {
      currency
      income
      expense
      profit
      transactionCount
    }
    groups {
      date
      transactionCount
      entries {
        runningBalance
        transaction {
          id
          type
          amount
          paymentStatus
        }
      }
    }
  }
}
```

Variabel:

```json
{ "input": { "month": "2026-06", "timezoneOffsetMinutes": 420, "filter": "expense" } }
```

Query tab Failed:

```graphql
query Failed($input: BookkeepingFailedPaymentsInput!) {
  bookkeepingFailedPayments(input: $input) {
    month
    totalCount
    retryableCount
    payments {
      id
      amount
      method
      status
      retryCount
      maxRetries
      canRetry
      lastError
      createdAt
    }
  }
}
```

---

### Timezone

Bulan **tidak** dihitung dalam UTC. Client mengirim `timezoneOffsetMinutes` sebagai
jumlah menit ke timur UTC:

| Timezone             | Offset |
| -------------------- | ------ |
| UTC                  | `0`    |
| WIB (Asia/Jakarta)   | `420`  |
| WITA (Asia/Makassar) | `480`  |
| WIT (Asia/Jayapura)  | `540`  |

Contoh untuk `month = "2026-06"` dan `timezoneOffsetMinutes = 420`:

- `start` = `2026-05-31T17:00:00.000Z` (inklusif)
- `endExclusive` = `2026-06-30T17:00:00.000Z` (eksklusif)
- transaksi `2026-05-31T18:00:00.000Z` masuk **Juni** dan grup `2026-06-01`.

---

### Alur Kerja (Data Flow)

```text
Client (cx-dompetqu)
   │  bookkeepingLedger(month, timezoneOffsetMinutes, filter)
   ▼
GraphQL resolver
   │
   ▼
BookkeepingService.getLedger()
   │
   ▼
GetBookkeepingLedgerUseCase
   │  BookkeepingPeriod.from(input)
   │  validasi filter
   ▼
BookkeepingSource (port)
   │
   ▼
BookkeepingSourceAdapter
   │  TransactionService.transactionsByDateRange(start, endExclusive, userId)
   ▼
BookkeepingLedger.build()
   │  filter periode + tipe
   │  hitung ringkasan per currency
   │  hitung running balance (kronologis)
   │  group per tanggal lokal (terbaru dulu)
   ▼
Resolver memetakan ke tipe GraphQL
   ▼
Response
```

Tab Failed memakai alur yang sama, tetapi sumbernya
`PaymentService.listPaymentsByStatus("failed", userId)` dan model
`BookkeepingFailedPayments`.

---

### Integrasi dengan Module Lain

```text
BookkeepingSourceAdapter
   ├──► TransactionService.transactionsByDateRange()   ← module TRANSACTIONS
   └──► PaymentService.listPaymentsByStatus("failed")  ← module PAYMENT
```

Aturan boundary:

- Semua akses lintas modul lewat barrel/service publik, bukan repository/entity
  internal.
- `core/` bookkeeping tidak mengimpor Drizzle, entity transactions, atau entity
  payment.
- Tidak ada migrasi/tabel baru.

---

### Testing

- `tests/bookkeeping/bookkeeping_model.test.ts` — aturan periode/timezone,
  ringkasan per mata uang, running balance, filter, grup harian, payment gagal.
- `tests/bookkeeping/bookkeeping_service.test.ts` — validasi input, penerusan batas
  bulan ke port, filter, dan query payment gagal.
- `tests/e2e/bookkeeping.e2e.test.ts` — query GraphQL lewat HTTP untuk ledger,
  filter, dan validasi bulan.

Jalankan:

```bash
bun test --preload ./tests/setup.ts tests/bookkeeping tests/e2e/bookkeeping.e2e.test.ts
```

---

### Catatan Arsitektur

- **Read model / orchestration module**: bookkeeping tidak memiliki persistence
  sendiri; sumber kebenaran tetap transactions dan payment.
- **Perhitungan di domain model**: resolver dan use case tidak menghitung agregat,
  sehingga aturan ledger hanya punya satu sumber.
- **Multi-currency**: ringkasan dipisah per kode mata uang; saldo berjalan juga
  dihitung terpisah per mata uang. Nilai antar mata uang tidak dijumlahkan.
- **Konsisten dengan client**: running balance dimulai dari nol pada bulan/filter
  terpilih, sama seperti `bookkeeping_store.dart` di `cx-dompetqu`. Filter
  `expense` karena itu menghasilkan saldo negatif.
- **Tab Failed terpisah**: `failed` bukan nilai `Transaction.type`, sehingga tidak
  dimasukkan ke enum filter ledger; client memakai query
  `bookkeepingFailedPayments`.
