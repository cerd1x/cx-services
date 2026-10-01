## Payment Module — Penjelasan & Alur Kerja

### 📑 Daftar Isi (Table of Contents)

- [Tujuan Module](#tujuan-module)
- [Struktur Direktori & File](#struktur-direktori-file)
- [Penjelasan File Per-File](#penjelasan-file-per-file)
  - [1. `payment.model.ts`](#1-paymentmodelts)
  - [2. `invoice.model.ts`](#2-invoicemodelts)
  - [3. `retry-policy.vo.ts`](#3-retry-policyvots)
  - [4. `logger.ts`](#4-logerts)
  - [5. `payment-error.ts`](#5-payment-errorts)
  - [6. `payment-repository.port.ts`](#6-payment-repositoryportts)
  - [7. `invoice-repository.port.ts`](#7-invoice-repositoryportts)
  - [8. `payment-gateway.port.ts`](#8-payment-gatewayportts)
  - [9. `process-payment.use-case.ts`](#9-process-paymentuse-casets)
  - [10. `create-invoice.use-case.ts`](#10-create-invoiceuse-casets)
  - [11. `retry-payment.use-case.ts`](#11-retry-paymentuse-casets)
  - [12. `payment.service.ts`](#12-paymentservicets)
  - [13. `payment.repository.ts`](#13-paymentrepositoryts)
  - [14. `invoice.repository.ts`](#14-invoicerepositoryts)
  - [15. `mock-gateway.adapter.ts`](#15-mock-gatewayadapterts)
  - [16. `payment.gql`](#16-paymentgql)
  - [17. `payment.resolver.ts`](#17-paymentresolverts)
  - [18. `payment.composition.ts`](#18-paymentcompositionts)
  - [19. `index.ts`](#19-indexts)
  - [20. `asset-gateway.adapter.ts`](#20-asset-gatewayadapterts)
- [Use Cases](#use-cases)
  - [`processPayment(input)`](#processpaymentinput---proses-pembayaran)
  - [`retryPayment(paymentId, userId)`](#retrypaymentpaymentid-userid---retry-pembayaran-gagal)
  - [`createInvoice(input)`](#createinvoiceinput---buat-tagihan)
  - [`issueInvoice` / `cancelInvoice`](#issueinvoiceid-userid--cancelinvoiceid-userid---lifecycle-tagihan)
- [Alur Kerja (Data Flow)](#alur-kerja-data-flow)
- [Skema Database (Drizzle)](#skema-database-drizzle)
- [Integrasi dengan Module Lain](#integrasi-dengan-module-lain)
- [Cara Menggunakan (Usage Guide)](#cara-menggunakan-usage-guide)
  - [1. Inisialisasi Module](#1-inisialisasi-module-app-startup)
  - [2. AssetPaymentGateway](#2-menggunakan-assetpaymentgateway-debit-saldo-asset-user)
  - [3. ProcessPayment GraphQL](#3-memproses-pembayaran-graphql-mutation)
  - [4. Retry Payment](#4-retry-pembayaran-gagal)
  - [5. Create Invoice](#5-membuat-invoice)
  - [6. Lifecycle Invoice](#6-lifecycle-invoice)
  - [7. Query Data](#7-query-data)
  - [8. Service API (Server-Side)](#8-menggunakan-via-service-server-side--script)
  - [9. Custom Gateway Production](#9-custom-payment-gateway-production)
  - [10. Testing](#10-testing)
- [Fitur Utama (Features)](#fitur-utama-features)
- [Catatan Arsitektur](#catatan-arsitektur)

---

### Tujuan Module

Melakukan kontrol terhadap **pembayaran (payment)** dan **tagihan (invoice)** dalam sistem. Module ini bertanggung jawab atas pemrosesan pembayaran via payment gateway (abstraksi port), pembuatan & lifecycle invoice, serta retry policy dengan exponential backoff untuk pembayaran yang gagal. Terpisah dari module `transactions` — payment mencatat status pembayaran, sedangkan transaksi mencatat laporan keuangan.

---

### Struktur Direktori & File

```text
domain/payment/
├── core/
│   ├── errors/
│   │   └── payment-error.ts
│   ├── model/
│   │   ├── index.ts
│   │   ├── invoice.model.ts
│   │   └── payment.model.ts
│   ├── ports/
│   │   └── out/
│   │       ├── invoice-repository.port.ts
│   │       ├── payment-gateway.port.ts
│   │       └── payment-repository.port.ts
│   ├── usecase/
│   │   ├── cancel-invoice.usecase.ts
│   │   ├── create-invoice.use-case.ts
│   │   ├── get-invoice.usecase.ts
│   │   ├── get-payment.usecase.ts
│   │   ├── issue-invoice.usecase.ts
│   │   ├── list-invoices-by-status.usecase.ts
│   │   ├── list-invoices.usecase.ts
│   │   ├── list-payments-by-status.usecase.ts
│   │   ├── list-payments.usecase.ts
│   │   ├── process-payment.use-case.ts
│   │   └── retry-payment.use-case.ts
│   └── value-objects/
│       ├── logger.ts
│       └── retry-policy.vo.ts
├── adapters/
│   ├── driven/
│   │   ├── drizzle/
│   │   │   ├── invoice.repository.ts
│   │   │   └── payment.repository.ts
│   │   └── payment-gateway/
│   │       ├── asset-gateway.adapter.ts
│   │       └── mock-gateway.adapter.ts
│   └── driving/
│       └── graphql/
│           ├── payment.gql
│           └── payment.resolver.ts
├── index.ts
└── payment.composition.ts
```

---

### Penjelasan File Per-File

#### 1. `core/model/payment.model.ts`

[`core/model/payment.model.ts`](core/model/payment.model.ts)

- **`PaymentStatus`** — enum: `pending`, `processing`, `completed`, `failed`, `refunded`, `cancelled`
- **`PaymentMethodType`** — enum: `cash`, `bank_transfer`, `ewallet`, `credit_card`, `debit_card`, `credit` (selaras dengan module `transactions`)
- **`VALID_TRANSITIONS`** — state machine status payment:
  - `pending → [processing, cancelled]`
  - `processing → [completed, failed]`
  - `completed → [refunded]`
  - `failed → [pending]` (via retry)
  - `refunded`, `cancelled` → terminal (`[]`)
- **`paymentSchema`** — Zod schema:
  - `id`: number optional
  - `userId`: number (required)
  - `invoiceId`: number optional
  - `amount`: `z.number().positive()` — harus > 0
  - `currency`: `z.string().length(3)` — ISO 3-huruf
  - `method`: enum payment method
  - `status`: enum status, default `"pending"`
  - `gatewayRef`: string (max 255) optional
  - `description`: string (max 500) optional
  - `retryCount`: `min(0).max(3)` default `0`
  - `maxRetries`: `min(0).max(5)` default `3`
  - `metadata`: `Record<string, unknown>` optional
  - `createdAt`, `updatedAt`: Date
- **`Payment` class** — Entity
  - `static new(data)` — factory (mengambil `maxRetries` dari policy).
  - `canTransitionTo(target)` — cek legalitas transisi status.
  - `transitionTo(target)` — throw `Error` jika transisi tidak legal.
  - `canRetry()` — kembali `true` jika `status === "failed" && retryCount < maxRetries`.
  - `incrementRetry()` — naikkan `retryCount` lalu reset status ke `"pending"`.
  - Validation methods (chainable): `validateAmount()`, `validateCurrency()`, `validateStatus()`, `validateMethod()`, `validateAll()`.

#### 2. `core/model/invoice.model.ts`

[`core/model/invoice.model.ts`](core/model/invoice.model.ts)

- **`InvoiceStatus`** — enum: `draft`, `issued`, `paid`, `partially_paid`, `overdue`, `cancelled`
- **`InvoiceItem`** — `{ description, quantity (int+), unitPrice (positif) }`
- **`invoiceSchema`** — Zod schema dengan field `subtotal` positif, `tax` ≥ 0 (default 0), `totalAmount` positif, `currency` 3-huruf, `status` default `"draft"`
- **`Invoice` class** — Entity
  - `static new(data)` — factory; **menghitung otomatis** `subtotal = Σ(quantity × unitPrice)`, `totalAmount = subtotal + tax`.
  - `static calculateTotal(items, tax?)` — helper perhitungan.
  - `isOverdue()` — `true` jika `dueAt` lewat & status bukan `cancelled`/`paid`.
  - `markAsIssued()` — hanya dari `draft`; set `issuedAt = new Date()`.
  - `markAsPaid()` — hanya dari `issued`/`partially_paid`; set `paidAt`.
  - `markAsCancelled()` — menolak jika status `paid` ("Cannot cancel a paid invoice").
  - `toData()` — serialize ke `InvoiceData` (dipakai repository).
  - Validation methods: `validateStatus()`, `validateAmount()`, `validateCurrency()`, `validateAll()`.

#### 3. `core/value-objects/retry-policy.vo.ts`

[`services/domain/payment/core/value-objects/retry-policy.vo.ts`](./core/value-objects/retry-policy.vo.ts)

- **`RetryPolicy`** — immutable VO untuk aturan retry:
  - Default: `maxRetries: 3`, `baseDelayMs: 1000`, `backoffMultiplier: 2`, `maxDelayMs: 30000`
  - `calculateDelay(attempt)` — `baseDelayMs × backoffMultiplier^(attempt-1)`, di-cap `maxDelayMs`.
  - `shouldRetry(currentRetryCount)` — `currentRetryCount < maxRetries`.
  - `getNextRetryDelay(currentRetryCount)` — `-1` jika tidak boleh retry, selain itu delay berikutnya.

#### 4. `core/value-objects/logger.ts`

- Membuat instance logger khusus `PaymentService` (prefix `"PaymentService"`, file `payment-service-log.log`).

#### 5. `core/errors/payment-error.ts`

[`services/domain/payment/core/errors/payment-error.ts`](./core/errors/payment-error.ts)

- **`PaymentError`** (base, extends `ServiceError`)
- **`PaymentValidationError`** (400), **`PaymentNotFoundError`** (404), **`PaymentGatewayError`** (502), **`PaymentRetryExhaustedError`** (422)
- **`InvoiceError`** (base), **`InvoiceValidationError`** (400), **`InvoiceNotFoundError`** (404)

#### 6. `core/ports/out/payment-repository.port.ts`

[`services/domain/payment/core/ports/out/payment-repository.port.ts`](./core/ports/out/payment-repository.port.ts)

**Abstract class `PaymentRepository`** — kontrak repository. Semua method `abstract`:

1. **`save(payment)`** — insert baru; return `PaymentData`.
2. **`findById(id, userId)`** — cari by ID + pemilik; `null` jika tidak ada.
3. **`findAll(userId)`** — semua payment milik user.
4. **`findByStatus(status, userId)`** — filter by status.
5. **`findByInvoiceId(invoiceId, userId)`** — payment milik sebuah invoice.
6. **`findByGatewayRef(gatewayRef, userId)`** — cari berdasarkan ref dari gateway.
7. **`update(id, data: PaymentUpdateData, userId)`** — update parsial (`status`, `gatewayRef`, `description`, `metadata`, `retryCount`).
8. **`delete(id, userId)`** — hapus.

#### 7. `core/ports/out/invoice-repository.port.ts`

[`services/domain/payment/core/ports/out/invoice-repository.port.ts`](./core/ports/out/invoice-repository.port.ts)

**Abstract class `InvoiceRepository`** — `save`, `findById`, `findByInvoiceNumber`, `findAll`, `findByStatus`, `update` (parsial: `status`, `customerId`, `description`, `dueAt`, `paidAt`, `issuedAt`, `metadata`), `delete`.

#### 8. `core/ports/out/payment-gateway.port.ts`

[`services/domain/payment/core/ports/out/payment-gateway.port.ts`](./core/ports/out/payment-gateway.port.ts)

**Abstract class `PaymentGateway`** — port outbound ke provider pembayaran:

- `charge(request: GatewayChargeRequest): Promise<GatewayChargeResponse>`
  - Request: `{ userId, assetId?, amount, currency, method, description?, metadata? }` — `userId` wajib (gateway perlu tahu siapa yang didebit), `assetId` opsional (untuk gateway berbasis asset)
  - Response: `{ success, gatewayRef, status, raw?, error? }` — `status` ∈ `pending|processing|completed|failed`
- `refund(request: GatewayRefundRequest): Promise<GatewayRefundResponse>`
  - Request: `{ gatewayRef, amount?, reason? }`; Response: `{ success, refundId, status, raw?, error? }`
- `getStatus(gatewayRef): Promise<GatewayStatusResponse>` — `{ gatewayRef, status, raw? }`

#### 9. `core/usecase/process-payment.use-case.ts`

[`services/domain/payment/app/use-cases/process-payment.use-case.ts`](./app/use-cases/process-payment.use-case.ts)

**Singleton pattern.** 1. Validasi input via `Payment.new(...).validateAll()` (amount > 0, currency ISO, method valid). 2. Transisi `pending → processing`. 3. `save` ke repository (status `processing`). 4. Rekonstruksi entity dari data tersimpan. 5. Panggil `gateway.charge(...)`:
- Sukses → simpan `gatewayRef`, transisi `processing → completed`.
- Gagal (response `success: false`) → transisi `processing → failed`, tulis `metadata.lastError`.
- Gateway throw → transisi `processing → failed`, tulis `lastError` (pesan atau `"Unknown gateway error"`).
6. `update` hasil akhir (status, gatewayRef, metadata, retryCount).

#### 10. `core/usecase/create-invoice.use-case.ts`

[`services/domain/payment/app/use-cases/create-invoice.use-case.ts`](./app/use-cases/create-invoice.use-case.ts)

**Singleton pattern.**
- `execute(input)` — generate nomor `INV-yyyymmdd-xxxx`, `Invoice.new(...).validateAll()` (subtotal/total otomatis), `invoiceRepo.save(invoice.toData())`.
- `getInvoice(id, userId)` — by ID; throw `InvoiceValidationError` jika tidak ditemukan.
- `listInvoices(userId)` — semua invoice user.
- `issueInvoice(id, userId)` — muat ulang entity (dengan `status` existing agar business rule enforce), panggil `markAsIssued()` (hanya dari `draft`), update status.
- `cancelInvoice(id, userId)` — `markAsCancelled()` (menolak invoice `paid`), update status.

#### 11. `core/usecase/retry-payment.use-case.ts`

[`services/domain/payment/app/use-cases/retry-payment.use-case.ts`](./app/use-cases/retry-payment.use-case.ts)

**Singleton pattern.**
1. `findById` → throw `PaymentRetryExhaustedError` jika tidak ada.
2. Rekonstruksi entity `Payment` dari data tersimpan.
3. Gate: `!payment.canRetry() || !retryPolicy.shouldRetry(retryCount)` → throw `PaymentRetryExhaustedError(paymentId, maxRetries)`.
4. `incrementRetry()` (retryCount +1, status → `pending`) lalu `transitionTo("processing")`, update status `processing` + `retryCount`.
5. `gateway.charge(...)` dengan `metadata.isRetry: true` & `retryAttempt`:
   - Sukses → `gatewayRef` + `completed`.
   - Gagal/throw → `failed` + `lastError` + `nextRetryDelayMs: retryPolicy.getNextRetryDelay(retryCount)`.
6. Update akhir.

#### 12. `app/payment.service.ts`

[`services/domain/payment/app/payment.service.ts`](./app/payment.service.ts)

**Facade** — semua use case diaggregasikan di sini. **Singleton via `PaymentService.init(processPayment, createInvoice, retryPayment, paymentRepo, invoiceRepo)`.**

Method publik:

**Group Payment:**

1. **`processPayment(input)`** → `Promise<PaymentData>`
   - **Parameter:** `{ userId, amount, currency, method, invoiceId?, description? }`
   - **Tugas:** Memproses pembayaran baru — membangun `Payment`, transisi `pending → processing`, simpan ke DB (status `processing`), panggil `ProcessPaymentUseCase` → `gateway.charge()`, lalu update hasil akhir (`completed`/`failed` + `gatewayRef`/`lastError`).
   - **Throw:** error validasi (amount ≤ 0, currency bukan 3 huruf, method tidak valid).

2. **`getPayment(id: ID, userId: ID)`** → `Promise<PaymentData>`
   - **Tugas:** Ambil satu payment by ID milik user. DB lookup via `paymentRepo.findById`.
   - **Throw:** `PaymentValidationError("Payment <id> not found")` jika tidak ditemukan atau bukan milik user.

3. **`listPayments(userId: ID)`** → `Promise<PaymentData[]>`
   - **Tugas:** Semua payment milik user (tanpa filter status), diurutkan default dari repository.

4. **`listPaymentsByStatus(status: string, userId: ID)`** → `Promise<PaymentData[]>`
   - **Parameter:** `status` — salah satu `pending|processing|completed|failed|refunded|cancelled`.
   - **Tugas:** Filter payment milik user berdasarkan status (mis. tampilkan hanya yang `failed` untuk dashboard retry).

5. **`retryPayment(id: ID, userId: ID)`** → `Promise<PaymentData>`
   - **Tugas:** Retry payment yang gagal — rekonstruksi entity, cek `canRetry()` + `RetryPolicy.shouldRetry()`, `incrementRetry()` (`retryCount+1`, status → `pending` → `processing`), charge lagi via gateway, update status.
   - **Throw:** `PaymentRetryExhaustedError` jika payment tidak ada, sudah melewati batas `maxRetries`, atau bukan berstatus `failed`.

**Group Invoice:**

6. **`createInvoice(input)`** → `Promise<InvoiceData>`
   - **Parameter:** `{ userId, customerId?, items, currency, tax?, dueAt?, description? }`.
   - **Tugas:** Generate nomor `INV-<yyyyMMdd>-<xxxx>`, bangun `Invoice` (subtotal & total otomatis dari `items` + `tax`), validasi, lalu simpan ke DB via `createInvoiceRepo.save`.
   - **Throw:** `InvoiceValidationError` jika `items` kosong atau `save` tidak mengembalikan `id`.

7. **`getInvoice(id: ID, userId: ID)`** → `Promise<InvoiceData>`
   - **Tugas:** Ambil satu invoice by ID milik user.
   - **Throw:** `InvoiceValidationError("Invoice with id <id> not found")` jika tidak ditemukan/bukan milik user.

8. **`listInvoices(userId: ID)`** → `Promise<InvoiceData[]>`
   - **Tugas:** Semua invoice milik user.

9. **`listInvoicesByStatus(status: string, userId: ID)`** → `Promise<InvoiceData[]>`
   - **Parameter:** `status` — salah satu `draft|issued|paid|partially_paid|overdue|cancelled`.
   - **Tugas:** Filter invoice milik user berdasarkan status (mis. daftar invoice yang masih `draft` untuk di-issue).

10. **`issueInvoice(id: ID, userId: ID)`** → `Promise<InvoiceData>`
    - **Tugas:** Rekonstruksi invoice dari DB, panggil `markAsIssued()` (hanya legal dari status `draft`), lalu update status → `issued`.
    - **Throw:** error `Cannot issue invoice in status: <status>` jika bukan `draft`.

11. **`cancelInvoice(id: ID, userId: ID)`** → `Promise<InvoiceData>`
    - **Tugas:** Rekonstruksi invoice, panggil `markAsCancelled()`, lalu update status → `cancelled`.
    - **Throw:** `Cannot cancel a paid invoice` jika invoice sudah berstatus `paid`.

#### 13. `adapters/driven/drizzle/payment.repository.ts`

[`services/domain/payment/adapters/driven/drizzle/payment.repository.ts`](./adapters/driven/drizzle/payment.repository.ts)

Implementasi `PaymentRepository` via **Drizzle ORM** + **SQLite (D1)**. Semua query difilter `userId` (guard kepemilikan). `metadata` disimpan sebagai JSON string & diparse balik di `#parseMetadata()`. Helper `#toPayment()` memetakan row → `PaymentData`.

#### 14. `adapters/driven/drizzle/invoice.repository.ts`

[`services/domain/payment/adapters/driven/drizzle/invoice.repository.ts`](./adapters/driven/drizzle/invoice.repository.ts)

Implementasi `InvoiceRepository`. `items` disimpan sebagai JSON string, diparse di `#toInvoice()`. Menangani `issuedAt`/`paidAt`/`dueAt` untuk update lifecycle.

#### 15. `adapters/driven/payment-gateway/mock-gateway.adapter.ts`

[`services/domain/payment/adapters/driven/payment-gateway/mock-gateway.adapter.ts`](./adapters/driven/payment-gateway/mock-gateway.adapter.ts)

Implementasi **`PaymentGateway`** untuk dev/test (deterministik):
- `failNext(count = 1)` — simulasi `count` charge berikutnya gagal (helper testing).
- `charge` gagal jika `amount <= 0` atau (`method === "credit_card"` dan `amount > 100000000`) → `"Credit card payment limit exceeded"`.
- `refund` & `getStatus` selalu sukses (mock).

#### 16. `adapters/driving/graphql/payment.gql`

[`services/domain/payment/adapters/driving/graphql/payment.gql`](./adapters/driving/graphql/payment.gql)

- **Query**: `payment(id)`, `payments`, `paymentsByStatus(status)`, `invoice(id)`, `invoices`, `invoicesByStatus(status)` — semua `@authorized`.
- **Mutation**: `processPayment(input)`, `retryPayment(paymentId)`, `createInvoice(input)`, `issueInvoice(id)`, `cancelInvoice(id)` — semua `@authorized`.
- **Enum**: `PaymentStatusEnum`, `InvoiceStatusEnum`, `PaymentMethodEnum`.
- **Scalar**: `DateTime` / `DateTimeOrTimestamp` (dari `graphql-scalars`).
- Field `Payment`/`Invoice` memakai hash ID (bukan numeric).

#### 17. `adapters/driving/graphql/payment.resolver.ts`

[`services/domain/payment/adapters/driving/graphql/payment.resolver.ts`](./adapters/driving/graphql/payment.resolver.ts)

Resolver menghubungkan schema ke `PaymentService`. `mapPayment()` / `mapInvoice()` memetakan `PaymentData`/`InvoiceData` → GraphQL response shape (ID numeric → hash via `ID.new(n)`), tanpa `any`. Semua field memerlukan `userAuth` dari context.

#### 18. `payment.composition.ts`

[`services/domain/payment/payment.composition.ts`](./payment.composition.ts)

**Wiring**: `PaymentRepositoryImpl` + `InvoiceRepositoryImpl` + `MockPaymentGateway` → init ketiga use case → `PaymentService.init(...)`. Export singleton `paymentService`. Container tetap memakai `MockPaymentGateway`; untuk memproses saldo asset, ganti gateway dengan `AssetPaymentGateway(assetService)` (lihat bagian 20).

#### 19. `index.ts`

[`services/domain/payment/index.ts`](./index.ts)

Public exports: `paymentService`, entity class & types (`Payment`, `PaymentData`, `PaymentUpdateData`, `PaymentStatus`, `PaymentMethodType`, `Invoice`, `InvoiceData`, `InvoiceItem`, `InvoiceUpdateData`, `InvoiceStatus`), `RetryPolicy`/`RetryPolicyConfig`, type `PaymentGateway` beserta request/response types, serta adapter `AssetPaymentGateway` (+ `AssetGatewayConfig`, `AssetResolver`).

#### 20. `adapters/driven/payment-gateway/asset-gateway.adapter.ts`

[`services/domain/payment/adapters/driven/payment-gateway/asset-gateway.adapter.ts`](./adapters/driven/payment-gateway/asset-gateway.adapter.ts)

Implementasi **`PaymentGateway`** berbasis **saldo asset internal** user — pembayaran diselesaikan dengan mendebit/mengkredit saldo asset lewat `AssetService`, bukan gateway eksternal:

- `charge({ userId, assetId?, amount, currency, method })`:
  1. Resolve asset target: `request.assetId` bila diberikan, else via `AssetResolver` (default: asset dengan `balance.code` sama dengan `currency`; fallback asset bernama `defaultAssetName` = `"MyCash"`; fallback asset pertama user).
  2. Validasi: `amount > 0`, asset ada, currency asset = currency payment, saldo cukup.
  3. Debit via `AssetService.mutateSubtractAsset` (menghasilkan mutation + transaksi `Subtract Balance`).
  4. Return `gatewayRef` ber-encode `asset:<userId>.<assetId>.<ts>.<nonce>.<currency>.<amount>` sehingga refund/getStatus bekerja tanpa state eksternal.
- `refund({ gatewayRef, amount? })`: parse ref → kredit balik via `mutateAddAsset` (`amount` request optional; default = jumlah asli dari ref). Partial refund didukung.
- `getStatus(gatewayRef)`: parse ref → `completed` (ref valid) / `failed` (bukan ref asset).
- Kegagalan tidak pernah mutasi saldo (selalu dicek dulu sebelum debit).

Dependency berupa interface struktural minimal `AssetMutator` (`assets`, `assetById`, `mutateAddAsset`, `mutateSubtractAsset`) — `AssetService` sudah memenuhinya. Untuk memakainya:

```ts
import { AssetPaymentGateway, ProcessPaymentUseCase } from "$services/domain/payment";
import { assetService } from "$services/domain/assets";

const gateway = new AssetPaymentGateway(assetService);
// ganti MockPaymentGateway saat wiring:
ProcessPaymentUseCase.init(payRepo, gateway);
```

Container default tetap memakai `MockPaymentGateway` (untuk test/Dev); ganti dengan `AssetPaymentGateway(assetService)` bila payment ingin memotong saldo asset user.

---

### Use Cases

#### `processPayment(input)` — Proses pembayaran

```text
Payment.new({...}).validateAll()
    └── validasi amount > 0, currency ISO, method valid
payment.transitionTo("processing")
paymentRepo.save(payment)                       → simpan status processing
gateway.charge({amount, currency, method, ...})
    ├── success true      → gatewayRef + transitionTo("completed")
    ├── success false     → transitionTo("failed") + metadata.lastError
    └── throw             → transitionTo("failed") + metadata.lastError
paymentRepo.update(id, {status, gatewayRef, metadata, retryCount})
    └── return PaymentData
```

#### `retryPayment(paymentId, userId)` — Retry pembayaran gagal

```text
paymentRepo.findById(id, userId)
    ├── null → PaymentRetryExhaustedError
    └── rekonstruksi entity Payment
syarat: status "failed" DAN retryCount < maxRetries
    └── jika tidak → PaymentRetryExhaustedError(paymentId, maxRetries)
payment.incrementRetry()                        → retryCount+1, status pending
payment.transitionTo("processing")
paymentRepo.update(id, {status, retryCount})    → status processing
gateway.charge({... metadata: { isRetry, retryAttempt }})
    ├── success true  → gatewayRef + completed
    └── gagal / throw → failed + lastError + nextRetryDelayMs (RetryPolicy)
paymentRepo.update(id, {status, gatewayRef, metadata, retryCount})
    └── return PaymentData
```

#### `createInvoice(input)` — Buat tagihan

```text
generate nomor "INV-<yyyyMMdd>-<4 digit>"
Invoice.new({...}).validateAll()                → subtotal & totalAmount otomatis
invoiceRepo.save(invoice.toData())
    └── id undefined → InvoiceValidationError
```

#### `issueInvoice(id, userId)` / `cancelInvoice(id, userId)` — Lifecycle tagihan

```text
getInvoice(id, userId)                          → throw jika tidak ada
rekonstruksi Invoice (dengan status existing)
    ├── issueInvoice → markAsIssued()  (hanya dari draft)
    └── cancelInvoice → markAsCancelled() (tolak jika paid)
invoiceRepo.update(id, { status })
```

---

### Alur Kerja (Data Flow)

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL (payment.gql → payment.resolver.ts)│
└──→──────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { payment, userAuth }                      │
└──→──────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil PaymentService (facade → use case layer)   │
└──→──────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Use case jalankan business logic:                            │
│    - Validasi input (Zod di entity)                             │
│    - State machine status payment (VALID_TRANSITIONS)           │
│    - Charge/retry via PaymentGateway (port outbound)            │
│    - Retry policy (exponential backoff)                         │
└──→──────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. RepositoryImpl (driven adapter) eksekusi DB query           │
│    - Drizzle ORM → SQLite D1 (payment & invoice table)          │
│    - Mapping row → PaymentData / InvoiceData                    │
└──→──────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Resolver map ke shape GraphQL (hash ID) → client            │
└───────────────────────────────────────────────────────────────┘
```

---

### Skema Database (Drizzle)

- **`payment`** — `id`, `user_id` (FK cascade), `invoice_id` (FK set null), `amount real`, `currency text(3)`, `method text` (enum), `status text` (enum, default `pending`), `gateway_ref`, `description`, `retry_count int default 0`, `max_retries int default 3`, `metadata text`, `created_at` (unixepoch), `updated_at`.
- **`invoice`** — `id`, `user_id` (FK cascade), `invoice_number` (UNIQUE), `customer_id` (FK contact, set null), `items text`, `subtotal real`, `tax real default 0`, `total_amount real`, `currency text(3)`, `status text` (enum, default `draft`), `issued_at`, `due_at`, `paid_at`, `description`, `metadata`, `created_at`, `updated_at`.
- **Relasi** (`relations.ts`): `payment.user` → one `user`; `payment.invoice` → one `invoice`; `invoice.user` → one `user`; `invoice.contact` → one `contact`; `invoice.payments` → many `payment`.
- Migrasi: `drizzle/20260910103426_polite_bill_hollister/` (menambahkan tabel `invoice`, `payment`, dan `gemini_oauth_token` drift).

---

### Integrasi dengan Module Lain

```text
processPayment / retryPayment
    ├──► PaymentGateway.charge()   ← PORT OUTBOUND (adapter: MockPaymentGateway)
    └──► PaymentRepositoryImpl      ← MODULE PAYMENT (driven adapter)

createInvoice
    ├──► Invoice.new()              ← DOMAIN (perhitungan subtotal/total)
    └──► InvoiceRepositoryImpl      ← MODULE PAYMENT

invoice.customerId → contact
payment.userId / .invoiceId → user / invoice   ← RELASI DATABASE

payment.method → PaymentMethod (cash, bank_transfer, ewallet, credit_card, debit_card, credit)
    └── selaras dengan enum di MODULE TRANSACTIONS (untuk konsistensi method)
```

Module `payment` berdiri sendiri (tidak sama dengan `transactions`): payment menjadi kandidat pengganti/alur pelengkap untuk pencatatan pembayaran, sementara transaksi tetap mencatat jurnal keuangan.

---

### Fitur Utama (Features)

| Kategori | Fitur | Deskripsi |
|----------|-------|-----------|
| **Payment Processing** | `processPayment` | Proses pembayaran end-to-end: validasi input → state machine `pending→processing` → charge gateway → `completed`/`failed` + `gatewayRef`/`lastError` |
| | **State Machine** | Transisi status di-guard `VALID_TRANSITIONS`: `pending→[processing,cancelled]`, `processing→[completed,failed]`, `completed→[refunded]`, `failed→[pending]` (via retry), `refunded/cancelled` = terminal |
| | **Payment Methods** | 6 method: `cash`, `bank_transfer`, `ewallet`, `credit_card`, `debit_card`, `credit` (selaras dengan module `transactions`) |
| | **Multi-Currency** | ISO 4217 3-huruf (IDR, USD, EUR, dll), validasi di Zod schema |
| | **Gateway Abstraction** | Port `PaymentGateway` — swap provider (Midtrans, Xendit, Stripe, Asset) tanpa ubah use case |
| **Retry & Resilience** | `retryPayment` | Retry pembayaran `failed` dengan exponential backoff: base 1s ×2^attempt, cap 30s, max 3 attempt (konfigurable via `RetryPolicy`) |
| | **Retry Metadata** | Setiap retry gagal catat `nextRetryDelayMs` di `metadata` untuk scheduling |
| | **Retry Exhausted** | Throw `PaymentRetryExhaustedError` jika melewati `maxRetries` atau bukan status `failed` |
| | **Idempotency** | `gatewayRef` unik per charge; `AssetPaymentGateway` encode ref sebagai `asset:<userId>.<assetId>.<ts>.<nonce>.<currency>.<amount>` |
| **Invoice Management** | `createInvoice` | Buat tagihan dengan nomor `INV-<yyyyMMdd>-<xxxx>`, subtotal & total otomatis dari items + tax |
| | **Invoice Lifecycle** | `draft → issued → paid/partially_paid/overdue → cancelled` (state machine) |
| | `issueInvoice` | Hanya dari `draft`; set `issuedAt` |
| | `cancelInvoice` | Tolak jika sudah `paid` ("Cannot cancel a paid invoice") |
| | **Overdue Detection** | `isOverdue()` otomatis cek `dueAt` vs now + status bukan `cancelled/paid` |
| **Asset-Based Payment** | `AssetPaymentGateway` | Debit/kredit saldo asset internal user via `AssetService` (no external gateway) |
| | **Auto Asset Resolve** | 1) `request.assetId` 2) match `balance.code === currency` 3) fallback `defaultAssetName` ("MyCash") 4) first user asset |
| | **Partial Refund** | Refund parsial didukung (amount optional, default = original amount) |
| **Data Integrity** | **Ownership Guard** | Semua query repository difilter `userId` — user hanya akses data milik sendiri |
| | **Soft Validation** | Zod schema di entity + chainable validation methods (`validateAmount`, `validateStatus`, `validateAll`) |
| | **Metadata Extensibility** | `metadata: Record<string, unknown>` di payment & invoice untuk data custom (retry info, gateway raw response, dll) |
| **Architecture** | **Hexagonal (Ports & Adapters)** | Domain/use case terpisah dari infrastructure (Drizzle, MockGateway) |
| | **DI Container** | `ServiceContainer` auto-inject via `this.deps.get(TokenClass)` — no singleton boilerplate |
| | **GraphQL Integration** | SDL + Resolver + `@authorized` directive; hash ID untuk keamanan |
| | **Testing Ready** | Unit test (mock repo/gateway), Integration test (D1Mock), 46 test total |

---

### Cara Menggunakan (Usage Guide)
 
#### 1. Inisialisasi Module (App Startup)
 
Module payment diinisialisasi di `payment.composition.ts` dan diekspos sebagai singleton `paymentService`:
 
```ts
import { paymentService } from "$services/domain/payment";
 
// paymentService sudah siap pakai setelah app startup (root.container.ts)
```
 
**Wajib dipanggil sekali di startup** (sudah ter-wiring di `composition/root.container.ts`):
```ts
import "$services/domain/payment"; // side-effect: inisialisasi paymentService
```
 
Default menggunakan **`MockPaymentGateway`** untuk development/testing.
 
---
 
#### 2. Menggunakan `AssetPaymentGateway` (Debit Saldo Asset User)
 
Untuk payment nyata yang memotong saldo asset internal user, ganti gateway di `payment.composition.ts`:
 
```ts
import { AssetPaymentGateway } from "$services/domain/payment";
import { assetService } from "$services/domain/assets";
 
// di payment.composition.ts
const gateway = new AssetPaymentGateway(assetService, {
  defaultAssetName: "MyCash",     // asset fallback name (default: "MyCash")
  currencyFallback: "IDR",        // fallback currency (default: "IDR")
});
 
const processPayment = new ProcessPaymentUseCase().setContext(
  new ServiceContainer().set(PaymentGateway, gateway)...
);
```
 
Atau via `PaymentService.init()`:
```ts
const gateway = new AssetPaymentGateway(assetService);
PaymentService.init(processPayment, createInvoice, retryPayment, ...);
```
 
**Logika resolve asset** (otomatis):
1. Jika `request.assetId` diberikan → pakai asset tersebut
2. Cari asset user dengan `balance.code === request.currency` (mis. IDR)
3. Fallback: cari asset bernama `defaultAssetName` (`"MyCash"`)
4. Fallback: asset pertama milik user
 
**Refund** juga otomatis kredit balik ke asset yang sama (parse dari `gatewayRef`).
 
---
 
#### 3. Memproses Pembayaran (GraphQL Mutation)
 
```graphql
mutation ProcessPayment($input: ProcessPaymentInput!) {
  processPayment(input: $input) {
    id
    amount
    currency
    method
    status
    gatewayRef
    createdAt
  }
}
```
 
**Variables:**
```json
{
  "input": {
    "amount": 50000,
    "currency": "IDR",
    "method": "bank_transfer",
    "invoiceId": "optional-hash-id",
    "description": "Pembayaran invoice #INV-20260921-1234"
  }
}
```
 
**Response sukses:**
```json
{
  "data": {
    "processPayment": {
      "id": "hash-id",
      "amount": 50000,
      "currency": "IDR",
      "method": "bank_transfer",
      "status": "completed",
      "gatewayRef": "asset:1.5.1727000000000.a1b2.IDR.50000",
      "createdAt": "2026-09-21T10:00:00.000Z"
    }
  }
}
```
 
**Response gagal (gateway decline):**
```json
{
  "data": {
    "processPayment": {
      "id": "hash-id",
      "amount": 50000,
      "currency": "IDR",
      "method": "credit_card",
      "status": "failed",
      "gatewayRef": null,
      "metadata": {
        "lastError": "Credit card payment limit exceeded"
      }
    }
  }
}
```
 
---
 
#### 4. Retry Pembayaran Gagal
 
```graphql
mutation RetryPayment($paymentId: ID!) {
  retryPayment(paymentId: $paymentId) {
    id
    status
    retryCount
    gatewayRef
    metadata {
      lastError
      nextRetryDelayMs
    }
  }
}
```
 
- Hanya bisa retry jika `status === "failed"` dan `retryCount < maxRetries` (default 3).
- Setiap retry: `retryCount + 1`, exponential backoff (1s → 2s → 4s → cap 30s).
- Jika melebihi `maxRetries` → throw `PaymentRetryExhaustedError`.
 
---
 
#### 5. Membuat Invoice
 
```graphql
mutation CreateInvoice($input: CreateInvoiceInput!) {
  createInvoice(input: $input) {
    id
    invoiceNumber
    subtotal
    tax
    totalAmount
    currency
    status
  }
}
```
 
**Variables:**
```json
{
  "input": {
    "customerId": "optional-hash-id",
    "items": [
      { "description": "Produk A", "quantity": 2, "unitPrice": 25000 },
      { "description": "Jasa B", "quantity": 1, "unitPrice": 100000 }
    ],
    "currency": "IDR",
    "tax": 5000,
    "dueAt": "2026-10-01T23:59:59.000Z",
    "description": "Tagihan bulan September"
  }
}
```
 
- `subtotal` & `totalAmount` dihitung otomatis: `Σ(quantity × unitPrice) + tax`.
- Status awal: `draft`.
 
---
 
#### 6. Lifecycle Invoice
 
**Issue (draft → issued):**
```graphql
mutation IssueInvoice($id: ID!) {
  issueInvoice(id: $id) {
    id
    status
    issuedAt
  }
}
```
Hanya legal dari status `draft`.
 
**Cancel (draft/issued → cancelled):**
```graphql
mutation CancelInvoice($id: ID!) {
  cancelInvoice(id: $id) {
    id
    status
  }
}
```
Tolak jika status `paid` ("Cannot cancel a paid invoice").
 
---
 
#### 7. Query Data
 
**List Payment (filter status):**
```graphql
query PaymentsByStatus($status: PaymentStatusEnum!) {
  paymentsByStatus(status: $status) {
    id
    amount
    currency
    method
    status
    invoice { id invoiceNumber }
    createdAt
  }
}
```
 
**Get Invoice by ID:**
```graphql
query Invoice($id: ID!) {
  invoice(id: $id) {
    id
    invoiceNumber
    items { description quantity unitPrice }
    subtotal
    tax
    totalAmount
    status
    dueAt
    issuedAt
    paidAt
  }
}
```
 
---
 
#### 8. Menggunakan via Service (Server-Side / Script)
 
```ts
import { paymentService } from "$services/domain/payment";
import { ID } from "$services/shared/kernel";
 
// 1. Proses pembayaran
const payment = await paymentService.processPayment({
  userId: 1,
  amount: 100000,
  currency: "IDR",
  method: "bank_transfer",
  invoiceId: 5,
  description: "Pembayaran order #123",
});
 
// 2. Retry payment gagal
const retried = await paymentService.retryPayment(
  ID.new(payment.id!),
  ID.new(1)
);
 
// 3. Buat invoice
const invoice = await paymentService.createInvoice({
  userId: 1,
  items: [{ description: "Item", quantity: 1, unitPrice: 50000 }],
  currency: "IDR",
  tax: 5000,
});
 
// 4. Issue invoice
const issued = await paymentService.issueInvoice(ID.new(invoice.id!), ID.new(1));
 
// 5. List payment user
const all = await paymentService.listPayments(ID.new(1));
const failed = await paymentService.listPaymentsByStatus("failed", ID.new(1));
 
// 6. List invoice
const drafts = await paymentService.listInvoicesByStatus("draft", ID.new(1));
```
 
---
 
#### 9. Custom Payment Gateway (Production)
 
Buat adapter baru implementasi `PaymentGateway`:
 
```ts
import { PaymentGateway, GatewayChargeRequest, GatewayChargeResponse } from "$services/domain/payment";
 
export class MidtransGateway implements PaymentGateway {
  async charge(req: GatewayChargeRequest): Promise<GatewayChargeResponse> {
    // 1. Panggil Midtrans API (Snap/Charge)
    // 2. Return { success: true, gatewayRef: "midtrans-transaction-id", status: "completed" }
    // 3. Jika gagal: { success: false, gatewayRef: "", status: "failed", error: "message" }
  }
 
  async refund(req: GatewayRefundRequest): Promise<GatewayRefundResponse> { ... }
  async getStatus(gatewayRef: string): Promise<GatewayStatusResponse> { ... }
}
 
// Lalu ganti di composition:
const gateway = new MidtransGateway();
```
 
Adapter hanya perlu handle I/O eksternal — **tidak mengubah business logic** di use case.
 
---
 
#### 10. Testing
 
**Unit Test Use Case (Mock Repo + Mock Gateway):**
```ts
import { MockPaymentRepo, MockInvoiceRepo, MockGateway } from "./test-utils";
import { ProcessPaymentUseCase } from "$services/domain/payment";
 
const payRepo = new MockPaymentRepo();
const gateway = new MockGateway();
const useCase = new ProcessPaymentUseCase().setContext(
  new ServiceContainer().set(PaymentRepository, payRepo).set(PaymentGateway, gateway)
);
 
const result = await useCase.execute({ userId: 1, amount: 50000, currency: "IDR", method: "cash" });
expect(result.status).toBe("completed");
```
 
**Integration Test (Real D1 via Mock):**
```ts
import { createMockD1, initTestTables } from "tests/utils/d1-mock";
import { PaymentRepositoryImpl, InvoiceRepositoryImpl } from "$services/domain/payment";
 
const env = createMockD1();
initTestTables(env.sqlite);
const db = drizzle(env.d1);
 
const payRepo = new PaymentRepositoryImpl(db);
const invRepo = new InvoiceRepositoryImpl(db);
const gateway = new MockGateway();
 
const useCase = new ProcessPaymentUseCase().setContext(
  new ServiceContainer().set(PaymentRepository, payRepo).set(PaymentGateway, gateway)
);
 
await useCase.execute({ userId: 1, amount: 10000, currency: "IDR", method: "ewallet" });
```
 
Run test:
```bash
bun test tests/payment/payment_integration.test.ts
bun test tests/payment/payment_service.test.ts
```
 
---
 
### Catatan Arsitektur

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**.
- **Ports & Adapters**: repository & gateway interface di `core/ports/out`, implementasi di `adapters/driven` (drizzle + mock gateway). Swap gateway asli (Midtrans/Xendit/Stripe) cukup dengan adapter baru — tanpa mengubah domain/use case.
- **Dependency Injection**: via `payment.composition.ts` — singleton diinisialisasi saat app startup; dimuat di `root.container.ts` dan diekspos lewat `YogaContext.payment`.
- **State machine**: semua transisi status payment di-guard `VALID_TRANSITIONS`; transisi ilegal melempar error — mencegah pembayaran diproses ulang dari status terminal.
- **Business rules**: jumlah harus > 0; retry hanya dari status `failed`; invoice hanya bisa di-issue dari `draft`; invoice `paid` tidak bisa di-cancel.
- **Retry policy**: `RetryPolicy` VO dengan exponential backoff (base 1s, ×2, cap 30s, max 3 attempt); `nextRetryDelayMs` dicatat ke `metadata` pembayaran yang gagal.
- **Cross-module consistency**: `PaymentMethodType` menyelaraskan nilai dengan enum payment method module `transactions`.
- **Testing**: unit test domain (`retry_policy.test.ts`), unit service (mock repo + mock gateway), dan integration test (D1Mock + repo asli) — 46 test.