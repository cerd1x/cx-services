## Killswitch Module — Kill Switch API per GraphQL Operation [L1-260]

### Tujuan Module [L3-12]

Menyediakan **kontrol operasional untuk mematikan API GraphQL tanpa deploy**. Saat
terjadi insiden (endpoint bocor, query terlalu berat, perhitungan salah), operator
perlu bisa memutus satu operation dalam hitungan detik. Module ini menyimpan status
matikan di D1 dan menerapkannya di lapisan GraphQL.

Batasan yang disengaja: ruang lingkupnya **hanya GraphQL root operation**. REST
(`/beta/report`, `/health`) di luar cakupan module ini.

**Sifat utama: fail-open.** Bila status tidak bisa dibaca, operation tetap
dijalankan. Kill switch tidak boleh bisa menjatuhkan seluruh API — itu akan
menjadi outage sendiri.

---

### Struktur Direktori & File [L14-33]

```text
domain/killswitch/
├── core/
│   ├── model/
│   │   ├── index.ts
│   │   └── api-killswitch.model.ts
│   ├── ports/
│   │   └── out/
│   │       └── api-killswitch-repository.port.ts
│   ├── usecase/
│   │   ├── disable-operation.usecase.ts
│   │   ├── enable-operation.usecase.ts
│   │   ├── is-operation-disabled.usecase.ts
│   │   └── list-disabled-operations.usecase.ts
│   └── value-objects/
│       └── logger.ts
├── adapters/
│   └── driven/
│       └── drizzle/
│           └── api-killswitch.repository.ts
├── index.ts
├── killswitch.composition.ts
└── killswitch.md
```

Tidak ada `adapters/driving/graphql/` — module ini tidak mengekspos SDL GraphQL
sendiri. Ia **menerapkan** switch ke schema milik modul lain lewat transformer.

---

### Skema Database [L35-52]

`shared/infra/db/drizzle-schema/api-killswitch.schema.ts` — tabel `api_killswitch`

| Kolom         | Tipe              | Nullable | Default         |
| ------------- | ----------------- | -------- | --------------- |
| `operation`   | `text` (PK)       | tidak    | —               |
| `reason`      | `text`            | ya       | `NULL`          |
| `disabled_at` | `integer` (unix s)| tidak    | `(unixepoch())` |
| `updated_at`  | `integer` (unix s)| ya       | —               |

Index `api_killswitch_disabled_at_idx` pada `disabled_at` untuk
`ORDER BY disabled_at DESC`.

#### Keputusan desain: "baris ada = dimatikan" [L41-52]

Tidak ada kolom boolean `disabled`. Menghapus baris = menghidupkan kembali.

Konsekuensinya:

- **State default saat tabel kosong adalah "semua aktif"** — persis yang
  diinginkan untuk fitur baru.
- Tidak ada mungkinnya baris saying `disabled = false` yang membingungkan.
- D1 down / tabel belum termigrasi → semua terbaca aktif → traffic tetap jalan
  (fail-open, bukan fail-closed).

---

### Format Operation Key [L54-64]

```
<Type>.<field>
```

Contoh: `Query.transactions`, `Mutation.createTransaction`.

Divalidasi Zod dengan `operationKeySchema`:

```ts
/^(Query|Mutation)\.[_A-Za-z][_0-9A-Za-z]*$/
```

Catatan:

- Hanya `Query` dan `Mutation` yang boleh dimatikan. `Subscription` sengaja
  dikecualikan karena repo ini tidak punya subscription, dan mengizinkan
  `Subscription` di masa depan akan membuka jalur yang tidak diimplementasikan.
- Nama field GraphQL tidak pernah mengandung `.`, jadi `split(".")` selalu
  menghasilkan tepat dua bagian dan tidak ambigu.
- Secara umum: `Query.__schema` tidak akan bisa dimatikan. Introspection
  sudah diatur terpisah oleh `noIntrospectionInProductionRule()`
  (`shared/infra/graphql/security-rules.ts`).

---

### Model [L66-84]

`core/model/api-killswitch.model.ts`

- **`KILLSWITCH_ROOT_TYPES`** — `["Query", "Mutation"]`
- **`buildOperationKey(type, field)`** — helper membentuk `"Type.field"`
- **`operationKeySchema`** — Zod regex untuk validasi key
- **`apiKillswitchSchema`** — `{ operation, reason?, disabledAt }`
- **`ApiKillswitch`** — `z.infer<typeof apiKillswitchSchema>`
- **`ApiDisabledError`** — `extends ServiceUnavailableError` (503), carry `operation` + `reason`

---

### Port [L86-100]

`core/ports/out/api-killswitch-repository.port.ts` — abstract class `ApiKillswitchRepository`

| Method                                        | Kegunaan                                  |
| --------------------------------------------- | ----------------------------------------- |
| `listDisabled()`                              | Semua switch aktif                        |
| `isDisabled(operation)`                       | Status satu operation (hot path)          |
| `disable(operation, reason?)`                 | Matikan; idempotent                       |
| `enable(operation)`                           | Nyalakan; `false` bila tidak ada yg berubah |
| `invalidateCache()`                           | Buang cache lokal                         |

`ApiKillswitch` di-re-export dari file port supaya adapter cukup mengimpor satu
file untuk kontrak beserta tipe datanya.

---

### Use Case [L102-124]

| Use Case                       | I/O                | Perilaku                                       |
| ------------------------------ | ------------------ | ---------------------------------------------- |
| `IsOperationDisabledUseCase`   | `string → DisabledState` | Hot path per request; tidak melempar error |
| `DisableOperationUseCase`      | `{operation, reason?} → ApiKillswitch` | Validasi key, `ValidationError` bila salah |
| `EnableOperationUseCase`       | `{operation} → {operation, enabled, changed}` | Validasi key, `changed` menandai perubahan nyata |
| `ListDisabledOperationsUseCase` | `void → ApiKillswitch[]` | Reporting                |

`IsOperationDisabledUseCase` sengaja tidak melempar error — keputusan ada di
transformer GraphQL, sehingga use case ini murni membaca state dan mudah diuji.

---

### Repository Drizzle + Cache [L126-158]

`adapters/driven/drizzle/api-killswitch.repository.ts`

Bacaan memakai `Cache<ApiKillswitch[]>` dengan **TTL 5 detik** (`DEFAULT_TTL_MS`).

Mengapa perlu cache: kill switch dibaca pada **setiap** request GraphQL. Query D1
per request terlalu mahal untuk sesuatu yang berubah jarang. TTL pendek adalah
kompromi terhadap batas keras Cloudflare Workers: D1 tidak punya pub/sub, jadi
isolate lain tidak bisa diberi tahu saat switch berubah.

Konsekuensi yang harus disadari:

- Perubahan terlihat **paling lama 5 detik** di isolate lain.
- Cache bersifat **per-isolate**, hilang saat isolate di-restart.
- `disable()`/`enable()` meng-invalidasi cache lokal, jadi isolate yang melayani
  request kontrol langsung melihat efeknya.
- Daftar switch aktif sengaja kecil, jadi menyimpan seluruh baris — bukan cuma
  himpunan key — tetap satu query dan sederhana.

`disable()` memakai `onConflictDoUpdate` pada `operation` sehingga idempotent dan
meng-refresh `reason` + `disabledAt` bila diaktifkan ulang.

---

### Bentuk Error [L160-172]

`ApiDisabledError` **mewarisi `ServiceUnavailableError`**, bukan `Error` biasa.
Ini bukan detail kecil: `maskedErrors` di `yoga-server.ts` hanya meneruskan
message + code untuk `ServiceError`.

```ts
maskError(raw, message, isDev) {
  const original = raw instanceof GraphQLError ? raw.originalError
    : raw instanceof ServiceError ? raw : undefined;
  if (original instanceof ServiceError) {
    return createGraphQLError(original.message, { extensions: { code: original.code } });
  }
  if (isDev && raw instanceof Error) return raw;
  return new Error(message); // ← "Internal server error"
}
```

Kalau transformer melempar `GraphQLError` mentah, `originalError`-nya kosong dan
tidak lolos cabang pertama — hasilnya code 503 **dan** alasan yang di-matikan
hilang, diganti `"Internal server error"`.

Konsekuensi yang harus diketahui klien:

| Aspek              | Nilai                                             |
| ------------------ | ------------------------------------------------- |
| `errors[0].message` | berisi operation + reason                        |
| `errors[0].extensions.code` | `503` (numeric, mengikuti konvensi repo) |
| HTTP status        | **tetap `200`**                                   |

HTTP `200` itu bukan bug: `maskError` tidak menyertakan `extensions.http`, jadi
seluruh `ServiceError` (400/401/404) juga balik dengan HTTP 200. Klien wajib
memeriksa `extensions.code`, bukan HTTP status.

---

### Penerapan di GraphQL [L174-219]

#### Transformer [L176-210]

`shared/infra/graphql/directives.ts` — `killswitchTransformer`

```ts
export function killswitchTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.ROOT_FIELD]: (fieldConfig, fieldName, typeName) => {
      const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;
      const operation = buildOperationKey(typeName, fieldName);
      // ... resolve wrapper
    },
  });
}
```

**Sengaja tanpa directive.** Setiap root field otomatis bisa dimatikan, tanpa
perlu anotasi di SDL. Ini keputusan operasional: saat insiden kita harus bisa
mematikan API tanpa menunggu deploy, dan operation yang "lupa" dianotasi justru
yang paling mungkin ingin dimatikan. Directive opsional (`@enabled`) menggoda
tapi menciptakan gap yang persis di tempat paling berbahaya.

Kalau nanti directive tetap diinginkan, cukup tambahkan
`getDirective(schema, fieldConfig, "enabled")` sebagai penjaga — pemanggilan
service sudah ada di satu tempat.

`MapperKind.ROOT_FIELD` hanya menyasar `Query`, `Mutation`, dan `Subscription` —
bukan field nested seperti `Transaction.amount`.

#### Urutan transformer [L212-219]

`shared/infra/graphql/yoga-server.ts`

```ts
schema = authorizedDirectiveTransformer(schema, { exclude: ["signIn", "signUp"] });
schema = killswitchTransformer(schema);
```

Kill switch dipasang **setelah** (jadi outermost) supaya operation yang mati
berhenti sebelum resolver dan sebelum pemeriksaan auth.

---

### Kontrol Operator (REST) [L221-252]

Endpoint di `app.ts`, guarded header `x-admin-token`
(`appConfigs.killswitch.adminToken`, ENV `KILLSWITCH_ADMIN_TOKEN`):

| Method   | Path                            | Fungsi                            |
| -------- | ------------------------------- | --------------------------------- |
| `GET`    | `/admin/killswitch`             | Daftar switch aktif               |
| `POST`   | `/admin/killswitch/:operation`  | Matikan (`{ reason }` di body)    |
| `DELETE` | `/admin/killswitch/:operation`  | Nyalakan kembali                  |

Contoh:

```bash
curl -X POST "$API/admin/killswitch/Mutation.createTransaction" \
  -H "x-admin-token: $KILLSWITCH_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"reason":"incident #42"}'

curl "$API/admin/killswitch" -H "x-admin-token: $KILLSWITCH_ADMIN_TOKEN"
```

Mengapa REST, bukan GraphQL mutation: jalur kontrol harus tetap bisa dipakai saat
GraphQL bermasalah. Kalau switch-nya hanya bisa diubah lewat GraphQL, maka ketika
layer GraphQL that's yang rusak kita kehilangan kendali.

Perhatikan perbedaan orientasi fail-closed: **gerbang token kosong berarti semua
request ditolak.** Ini kebalikan dari fail-open di jalur baca — interface yang
bisa mematikan API produksi harus gagal tertutup.

---

### Wiring [L254-264]

```
shared/infra/db/drizzle-schema/api-killswitch.schema.ts
  → drizzle-schema/index.ts
domain/killswitch/*
  → composition/root.container.ts  (apiKillswitchService)
    → shared/infra/graphql/yoga-context.ts  (YogaContext.killswitch)
      → shared/infra/graphql/directives.ts  (killswitchTransformer)
```

Test memakai `tests/e2e/_helper.ts` yang memanggil `yogaFetch` langsung, jadi
transformer ikut ter-cover tanpa perlu Elysia.

---

### Pengujian [L266-274]

- `tests/killswitch/api_killswitch_service.test.ts` — unit dengan mock port:
  isolasi per operation, idempotensi, validasi key, `changed` flag.
- `tests/e2e/killswitch.e2e.test.ts` — GraphQL sungguhan lewat `yogaFetch`:
  operation aktif jalan, operation mati ditolak dengan pesan + `code: 503`,
  operation lain tidak terganggu, mutation ikut ter-cover, dan re-enable
  mengembalikan fungsi.

> **Catatan maintener:** `tests/utils/d1-mock.ts` berisi DDL yang ditulis tangan,
> bukan hasil generate dari skema Drizzle. Tabel `api_killswitch` **sudah**
> ditambahkan di sana — kalau menambah kolom baru, DDL itu wajib disinkronkan
> manual atau seluruh integration/e2e test akan gagal dengan "no such table".