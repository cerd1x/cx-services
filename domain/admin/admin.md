## Admin Module — RBAC dan Operasi Lintas-User [L1-351]

### Tujuan Module [L3-23]

Sebelum module ini ada, otorisasi di `cx-services` bersifat **biner**: directive
`@authorized` hanya memeriksa "ada token valid atau tidak". Semua user yang
sudah login punya hak yang sama persis — termasuk `Query.users`,
`Mutation.createUser`, dan `Query.statistics`. Tidak ada konsep role di mana pun
di codebase.

Module ini menutup dua celah sekaligus:

1. **RBAC** — kolom `user.role` dan directive `@admin` yang menolak user biasa
   (403), terpisah dari `@authorized` yang hanya menolak tanpa token (401).
2. **Operasi lintas-user** — query admin yang memang butuh melihat data lebih
   dari satu user: daftar seluruh user, agregat global, dan transaksi milik
   user tertentu.

Batasan yang disengaja: modul ini **tidak menyertakan** endpoint operasional
REST yang sudah ada (`/admin/killswitch`, `/beta/report` di `app.ts`). Keduanya
masih dijaga shared-secret `x-admin-token` dan belum dimodularisasi.

---

### Struktur Direktori & File [L25-60]

```text
domain/admin/
├── core/
│   ├── model/
│   │   └── admin.model.ts                  # AdminUserView, AdminOverview, AdminTransactionView, batas limit
│   ├── ports/
│   │   └── out/
│   │       └── admin-repository.port.ts    # abstract class: satu-satunya baca lintas-user
│   ├── usecase/
│   │   ├── ctx.ts                          # token DI untuk UserService
│   │   ├── delete-any-user.usecase.ts
│   │   ├── get-admin-overview.usecase.ts
│   │   ├── list-admin-user-transactions.usecase.ts
│   │   ├── list-admin-users.usecase.ts
│   │   └── set-user-role.usecase.ts
│   └── value-objects/
│       └── logger.ts
├── adapters/
│   ├── driving/graphql/
│   │   ├── admin.gql                       # SDL + enum UserRole
│   │   └── admin.resolver.ts
│   └── driven/drizzle/
│       └── admin.repository.ts
├── admin.composition.ts                    # class service + factory + singleton
├── index.ts                                # barrel publik
└── admin.md
```

Kolom `role` sendiri **tidak** didefinisikan di modul ini. Ia adalah atribut
user, jadi tetap tinggal di `shared/infra/db/drizzle-schema/user.schema.ts` dan
`domain/user/core/model/user.model.ts`. Modul admin hanya mengonsumsi lewat
barrel `domain/user`.

---

### Skema Database [L62-89]

Tidak ada tabel baru. Kolom yang dipakai modul ini:

| Tabel     | Kolom | Tipe    | Nullable | Default |
| --------- | ----- | ------- | -------- | ------- |
| `user`    | `role` | `text` | tidak    | `'user'` |

Migrasi: `drizzle/20261010104536_breezy_gambit/migration.sql`

```sql
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;
```

Additive-only, jadi aman untuk tabel yang sudah berisi data production. Semua
user yang ada sebelum migrasi otomatis menjadi `user` — **tidak ada admin
otomatis**. Promoting user pertama harus dilakukan manual lewat SQL:

```bash
bunx wrangler d1 execute cxapp-db --remote \
  --command "UPDATE user SET role='admin' WHERE username='<username>';"
```

Nilai role disimpan sebagai **teks polos, bukan enum**. Penambahan peran baru
cukup di `userRoleSchema` (`user.model.ts`) tanpa perlu `ALTER TABLE` pada
tabel yang sudah berisi data.

---

### Model (`core/model/admin.model.ts`) [L91-119]

Tiga bentuk baca, masing-masing punya Zod schema yang di-`infer` — tidak ada type
yang ditulis manual.

| Type                  | Isi                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------- |
| `AdminUserView`       | User tanpa `password`, plus `role`. `createdAt` bertipe `Date`.                            |
| `AdminOverview`       | `totalUsers`, `totalAdmins`, `totalTransactions`, `totalAssets`, `totalIncome`, `totalExpense`. |
| `AdminTransactionView`| Proyeksi transaksi datar, selalu menyertakan `userId`.                                    |

`AdminUserView` sengaja **tidak** memakai entitas `User` milik modul user: bentuk
itu menyertakan `password`, yang tidak boleh pernah keluar lewat GraphQL.
`AdminTransactionView` juga bentuk sendiri — modul `transactions` tidak
mengekspor entitasnya lewat barrel, dan admin butuh `userId` yang tidak
relevan bagi user biasa.

Ada dua konstanta batas:

```ts
ADMIN_PAGE_MAX_LIMIT = 200;      // batas atas limit per request
ADMIN_PAGE_DEFAULT_LIMIT = 50;
```

Batas ini mencegah satu endpoint diagnosis menarik seluruh isi database lewat satu
request. `adminUserTransactions` adalah satu-satunya operasi yang punya parameter
berbahaya, jadi hanya dia yang perlu guard.

---

### Port (`core/ports/out/admin-repository.port.ts`) [L121-144]

```ts
export abstract class AdminRepository {
  abstract listUsers(): Promise<AdminUserView[]>;
  abstract getOverview(): Promise<AdminOverview>;
  abstract listUserTransactions(userId: number, limit: number): Promise<AdminTransactionView[]>;
}
```

**Mengapa port sendiri, bukan pakai service modul lain:**

- `UserRepository` dan `TransactionRepository` sengaja didesain terisolasi per
  `user_id` — setiap query-nya sudah mewajibkan filter kepemilikan.
- `domain/user` tidak mengekspor `UserRepository` lewat `index.ts`, jadi modul
  admin tidak bisa menyentuhnya tanpa menembus batas.
- Semua repository modul lain aman-by-construction: tidak ada jalur kode yang
  bisa membaca data user lain. Port ini adalah **satu-satunya** tempat di mana
  pembacaan lintas-user terjadi di seluruh aplikasi.

Konsekuensinya, port ini wajib diperlakukan sebagai trust boundary. Semua
method-nya hanya boleh dipanggil dari use case yang sudah melewati gate `@admin`.

---

### Use Case [L146-159]

| Use Case                            | Output                  | Guard                                                |
| ----------------------------------- | ----------------------- | ---------------------------------------------------- |
| `ListAdminUsersUseCase`             | `AdminUserView[]`       | —                                                    |
| `GetAdminOverviewUseCase`           | `AdminOverview`         | —                                                    |
| `ListAdminUserTransactionsUseCase`  | `AdminTransactionView[]`| `limit` positif & ≤ 200                               |
| `SetUserRoleUseCase`                | `User`                  | tolak `actorId === userId`, delegasi ke `userService` |
| `DeleteAnyUserUseCase`              | `boolean`               | tolak `actorId === userId`, delegasi ke `userService` |

Dua guard anti-lockout itu penting, bukan sekadar formalitas. `cerdix` adalah
satu-satunya admin; kalau dia boleh menurunkan role-nya sendiri sementara tidak
ada admin lain untuk menggantikannya, tidak ada yang bisa membatalkan. Guard yang
sama berlaku untuk hapus diri sendiri.

### Mengapa `actorId` jadi parameter, bukan dependency [L161-169]

`ServiceContainer` dibuat **sekali** saat composition root, sedangkan "siapa yang
sedang bertindak" berbeda tiap request. Kalau `actorId` ditaruh di container,
semua request akan melihat aktor yang sama — guard-nya jadi tidak berguna.
Karena itu resolver mengambilnya dari `context.userAuth.id` dan meneruskannya
sebagai input use case.

---

### Repository Drizzle (`adapters/driven/drizzle/admin.repository.ts`) [L171-200]

**`listUsers`** — `SELECT` seluruh kolom `user`, diurutkan `id`. `password`
tetap terbaca di memori tapi **tidak pernah** masuk ke model `AdminUserView`;
field itu tidak ada di bentuk tersebut, jadi tidak bisa bocor lewat GraphQL
secara tidak sengaja.

Kolom `created_at` disimpan sebagai teks `CURRENT_TIMESTAMP` (UTC), jadi
`new Date(\`${row.createdAt}Z\`)` dipakai agar tidak terbaca sebagai waktu lokal.

**`getOverview`** — empat `COUNT(*)` terpisah plus satu agregat `SUM` yang
dikelompokkan per `type`:

```ts
sql`sum(cast(replace(substr(${transactionTable.amount}, 5), ',', '') as real))`
```

Kolom `amount` disimpan sebagai teks `"<ISO> <angka>"` (lihat `Balance.new`).
Kode mata uang selalu 3 huruf diikuti satu spasi, jadi angka mulai pada offset
ke-5. Konversi dilakukan **di SQL**, bukan di JS, supaya agregat atas seluruh
tabel tidak perlu menarik semua baris ke memory worker — memory Worker terbatas.

Tidak ada `totalProfit`. `capital` bisa memakai mata uang berbeda dari `amount`,
sehingga selisihnya tidak selalu berarti apa pun.

**`listUserTransactions`** — keyset order `created_at DESC, id DESC`, memakai
index `transaction_user_id_created_at_id_idx` yang sudah ada. Dibatasi `limit`
dari use case.

---

### Directive `@admin` [L202-239]

`shared/infra/graphql/directives.ts:95` — `adminDirectiveTransformer`.

```ts
const { userAuth } = context as AuthContext;
if (!userAuth) throw new AuthenticationError("Missing or expired token");
if (userAuth.role !== "admin") throw new UnauthorizedError("Forbidden: admin role required");
```

Empat keputusan yang menentukan perilaku directive ini:

**1. Role dibaca dari database, bukan dari klaim JWT.**
`context.userAuth.role` diisi di `yoga-context.ts:111` dari objek `User` yang
di-`authorize()` dibaca ulang dari D1 setiap request. Kalau role ikut ditanam ke
payload JWT, mencabut akses admin baru berlaku setelah token kedaluwarsa —
bisa berjam-jam atau berhari-hari. Test e2e
`perubahan role berlaku tanpa login ulang` mengunci perilaku ini.

**2. Error dilempar sebagai `ServiceError`, bukan `GraphQLError`.**
`maskedErrors` di `yoga-server.ts` hanya meneruskan message dan code untuk
`ServiceError`; `GraphQLError` yang dilempar langsung akan dibuang menjadi
`"Internal server error"` tanpa `extensions.code`. Client tidak akan bisa
membedakan "belum login" dari "server rusak". Ini sempat terlewat dan baru
ketahuan karena test e2e meng-`assert` `extensions.code` — hasilnya `undefined`.

**3. Urutan transformer menentukan kode mana yang muncul.**
Di `yoga-server.ts`, `adminDirectiveTransformer` dipasang **setelah**
`authorizedDirectiveTransformer`, sehingga jadi wrapper terluar. Request
anonymous berhenti di `@admin` dengan 401 — bukan 403 — karena pemeriksaan
token selalu mendahului pemeriksaan role.

**4. Role hanya punya satu sumber kebenaran.**
`AdminService` dan seluruh use case-nya sengaja **tidak** mengulang cek role.
Kalau dua lapisan punya penilaian sendiri, keduanya bisa berbeda dan yang
lolos adalah yang lebih longgar.

---

### GraphQL API [L241-271]

`domain/admin/adapters/driving/graphql/admin.gql`

```graphql
type Query {
  adminUsers: [AdminUser!]! @admin
  adminOverview: AdminOverview! @admin
  adminUserTransactions(userId: ID!, limit: Int): [AdminTransaction!]! @admin
}

type Mutation {
  adminSetUserRole(input: AdminSetUserRoleInput!): User! @admin
  adminDeleteUser(userId: ID!): Boolean! @admin
}
```

Semua field bertanda `@admin`, **bukan** `@admin @authorized`. `@admin` sudah
menyertakan pemeriksaan token sendiri, jadi menumpuk `@authorized` hanya menambah
satu lapisan closure tanpa menambah keamanan.

`UserRole` di SDL menghasilkan TS enum lewat codegen
(`UserRole.Admin` / `UserRole.User`), sedangkan sisi domain memakai union
string. `toGraphQLRole()` di `admin.resolver.ts:13` adalah satu-satunya
jembatan keduanya — sengaja **tidak** `as UserRole` supaya nilai yang tak
dikenali jadi error compile-time, bukan string liar yang lolos ke client.

Field `id` dan `createdAt` dikonversi di resolver: `ID` di GraphQL adalah Sqids
hash (`string`), bukan integer database, dan `DateTime` adalah `Date`.

---

### Wiring [L273-290]

| File                                         | Perubahan                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `composition/root.container.ts:17,32`        | `import "$services/domain/admin"` + export `adminService`                 |
| `shared/infra/graphql/yoga-context.ts`       | `admin` pada `YogaContext`; `role` ditambahkan ke `userAuth`              |
| `shared/infra/graphql/yoga-server.ts`        | typeDefs + resolver didaftarkan; transformer `@admin` dipasang            |
| `shared/infra/graphql/directives.ts`         | `adminDirectiveTypeDefs` + `adminDirectiveTransformer`                     |
| `shared/infra/db/drizzle-schema/user.schema.ts` | kolom `role` + `userRoleValues`                                         |
| `domain/user/**`                             | `userRoleSchema`, `User.role`, `UserRepository.updateRole`, `UpdateUserRoleUseCase` |

`role` **tidak** ikut ditulis oleh `UserRepository.update()` maupun `save()`.
Penulisannya hanya lewat `updateRole()` yang terpisah. Kalau `role` ikut
ter-carry saat email atau avatar diubah, perubahan identitas rutin bisa menaikkan
privilege secara tidak sengaja — dan `update()` adalah jalur yang dipakai banyak
use case.

---

### Pengujian [L292-306]

```text
tests/admin/admin_service.test.ts    # unit: guard limit, guard self-role, guard self-delete
tests/admin/admin_directive.test.ts  # unit: 401 tanpa token, 403 user biasa, lolos untuk admin
tests/e2e/admin.e2e.test.ts          # e2e: GraphQL over HTTP via yogaFetch + D1Mock
```

Test directive sengaja **tidak** memakai `app.fetch()`. Yang diuji adalah
keputusan otorisasi itu sendiri, dan itu tidak butuh D1, cookie, maupun JWT
asli — test integrasi yang memalsukan token hanya akan menguji plumbing-nya.

Test e2e sanos memakai `getD1()` untuk promosi role lewat SQL. Itu justru
pola yang paling berharga: request dengan token yang sama, sebelum promosi
mendapat 403, sesudahnya langsung lolos.

### Test DB tidak lagi menulis DDL tangan [L308-324]

`tests/utils/d1-mock.ts` pernah punya ±160 baris `CREATE TABLE` yang ditulis
tangan, dan sudah pernah drift: kolom `user.role` dan
`transaction.payment_status` masuk ke schema tanpa masuk DDL, sehingga 56 test
e2e gagal dengan `signUp failed: undefined` — bukan karena bug aplikasi.

Sekarang DDL-nya di-generate runtime dari drizzle schema lewat
`tests/utils/d1-ddl.ts` (`getTableConfig` → `CREATE TABLE` / `CREATE INDEX`).
Test DB tidak mungkin tertinggal dari production lagi.

Generator itu hanya mendukung yang memang dipakai schema saat ini: kolom, PK
auto-increment, UNIQUE, CHECK enum, DEFAULT, foreign key, dan index. Kalau
schema nanti memakai fitur di luar itu, generator akan gagal cepat — itu lebih
baik daripada diam-diam membuat test DB yang tidak mencerminkan production.

---

### Catatan Arsitektur & Batasan [L326-351]

**`AdminRepository` adalah satu-satunya bypass kepemilikan data.** Kalau ada
kebutuhan baca lintas-user lain di masa depan, tambahkan method di port ini —
jangan membuka repository modul lain. Itu satu-satunya cara menjaga invariant
"semua query user lain ter-filter `user_id`" tetap benar.

**Belum ada operasi audit.** Perubahan role dan penghapusan user tidak
mencatat siapa yang melakukannya dan kapan. Untuk aplikasi yang sudah menyentuh data
keuangan, `outbox` yang sudah ada di modul lain adalah tempat yang wajar untuk
menaruh event audit — tapi itu penambahan tersendiri, bukan bagian scope ini.

**Belum ada pagination pada `adminUsers` dan `adminOverview`.** Keduanya memuat
seluruh tabel `user`. Untuk jumlah user pada orde ratusan masih aman; kalau
tumbuh ke ribuan, `adminUsers` perlu keyset pagination seperti
`adminUserTransactions`.

**`totalIncome` dan `totalExpense` belum dinormalisasi ke satu mata uang.**
Nilainya dijumlahkan apa adanya per tipe transaksi. Menjumlahkan lintas mata uang butuh
kurs atau tabel nilai tukar yang belum ada di sistem.

**`@authorized` lama masih melempar `GraphQLError`.** Directive `@admin` sudah
diperbaiki, tapi `@authorized` masih menghasilkan `"Internal server error"`
tanpa code untuk request tanpa token. Perbaikannya bentuknya sama — ganti ke
`AuthenticationError` — tapi belum dikerjakan karena berada di luar scope modul
ini.