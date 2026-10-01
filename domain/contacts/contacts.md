## Contacts Module — Penjelasan & Alur Kerja [L1-301]

### Tujuan Module [L3-8]

Melakukan kontrol terhadap **kontak/contact** user dalam sistem. Module ini bertanggung jawab atas manajemen daftar kontak (CRUD), import kontak dari file CSV/VCF, dan pengelompokan kontak.

---

### Struktur Direktori & File [L9-38]

```text
services/domain/contacts/
├── app/
│   └── contacts_service.ts           # Application service (orchestrasi use case)
├── core/
│   ├── model/
│   │   └── contacts.model.ts         # Model bisnis (data + behavior)
│   ├── usecase/
│   │   └── *.usecase.ts              # Use-case bisnis
│   ├── value-objects/
│   │   └── logger.ts                 # Logger khusus module
│   └── ports/out/
│       └── contacts-repository.port.ts   # Abstract port (repository contract)
├── adapters/
│   ├── driving/
│   │   └── graphql/
│   │       ├── contacts.gql          # SDL GraphQL
│   │       └── contacts.resolver.ts  # Resolvers GraphQL
│   └── driven/
│       └── drizzle/
│           ├── contacts.entity.ts    # Drizzle schema + Zod + Entity (persistence)
│           └── contacts.repository.ts    # Implementasi repository
└── contacts.composition.ts           # Composition root: Service.getInstance(new RepoImpl())
```

---

### Penjelasan File Per-File [L39-129]

#### 1. `adapters/driven/drizzle/contact.entity.ts` [L41-68]

[`services/domain/contacts/adapters/driven/drizzle/contact.entity.ts`](./adapters/driven/drizzle/contact.entity.ts)

- **`contactSchema`** — Zod schema (`z.object({...})`)
  - **Fields:**
    1. `id`: `z.number().optional()` — auto-generated
    2. `userId`: `z.number().optional()`
    3. `name`: `z.string().min(1).max(200)` — required
    4. `email`: `z.email().optional()`
    5. `phone`: `phoneSchema.optional()` — nomor utama/pertama (kompatibilitas API lama)
    6. `phones`: `z.array(phoneSchema).max(MAX_PHONES).optional()` — semua nomor (maks **10**)
    7. `group`: `z.string().max(50).optional()`
    8. `avatar`: `z.url().optional()`
    9. `createdAt`: `z.date().optional()`
    10. `updatedAt`: `z.date().optional()`
- **`normalizePhones(input)`** — mengubah input (`string | string[]`) → array unik, trim, cap `MAX_PHONES` (10). Empty → `undefined`
- **`MAX_PHONES = 10`** — konstanta batas maksimum nomor per kontak
- **`ContactType`** — `z.infer<typeof contactSchema>` (type alias)
- **`Contact` class** — Entity dengan private fields, method validasi per-field
  - **Properties:** `id`, `userId`, `name`, `email`, `phones?`, `group`, `avatar`, `createdAt`, `updatedAt`
  - **`phones`** — sumber kebenaran (array, maks 10)
  - **`phone` getter/setter** — akses kompat: getter = `phones[0]`, setter = jadikan nomor utama/pertama
  - **`constructor(data)`** — Menerima object `{ name, userId, email?, phone?, phones?, group?, avatar?, id?, createdAt?, updatedAt? }` (`phone`/`phones` bisa `string` atau `string[]`)
  - **`static new(data)`** — Factory method, shortcut ke `new Contact(data)`
  - **Validation methods (chainable, return `this`):**
    1. `validateName()` — `nameSchema.safeParse(this.name)`
    2. `validateEmail()` — `emailSchema.safeParse(this.email)` (skip if undefined)
    3. `validatePhone()` — `phoneSchema.safeParse(this.phone)` (nomor pertama; skip if undefined)
    4. `validatePhones()` — `phonesSchema.safeParse(this.phones)` (validasi semua nomor + limit 10; skip if undefined)
    5. `validateGroup()` — `groupSchema.safeParse(this.group)` (skip if undefined)
    6. `validateAvatar()` — `avatarSchema.safeParse(this.avatar)` (skip if undefined)
    7. `validateAll()` — Chain semua method di atas

#### 2. `core/value-objects/logger.ts` [L69-72]

- Membuat instance logger khusus untuk `ContactService` dengan prefix `"ContactService"` dan file log `contact-service-log.log`

#### 3. `core/ports/out/contact-repository.port.ts` [L73-78]

[`services/domain/contacts/core/ports/out/contact-repository.port.ts`](./core/ports/out/contact-repository.port.ts)

- **Abstract class `ContactRepository`** — Port (out) yang mendefinisikan kontrak repository. ContactService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/contact.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter). Pola parameter konsisten: `userId` selalu parameter pertama sebagai guard akses.

  **Daftar Method:**

  1. **`save(userId, contact)`** — Insert contact baru
     - Parameter:
       - `userId: number` — pemilik contact
       - `contact: Contact` — entity Contact lengkap
     - Return: `Promise<Contact>` — entity Contact yang tersimpan

  2. **`findById(userId, id)`** — Cari contact by ID + pemilik
     - Parameter:
       - `userId: number` — pemilik contact
       - `id: number` — ID contact
     - Return: `Promise<Contact | null>` — `null` jika tidak ditemukan

  3. **`findAll(userId)`** — Ambil semua contact milik user
     - Parameter:
       - `userId: number` — pemilik contact
     - Return: `Promise<Contact[]>` — selalu array (kosong `[]` jika tidak ada)

  4. **`update(userId, contact)`** — Update contact existing
     - Parameter:
       - `userId: number` — pemilik contact (guard akses)
       - `contact: Contact` — entity Contact dengan data baru
     - Return: `Promise<Contact>` — entity Contact hasil update

  5. **`delete(userId, id)`** — Hapus contact by ID + pemilik
     - Parameter:
       - `userId: number` — pemilik contact
       - `id: number` — ID contact
     - Return: `Promise<void>` — tidak mengembalikan apa pun

  6. **`findByPhone(userId, phone)`** — Cari contact yang memiliki nomor tertentu
     - Parameter:
       - `userId: number` — pemilik contact
       - `phone: string` — nomor yang dicari
     - Return: `Promise<Contact[]>` — semua contact user yang memuat nomor tsb (bisa lebih dari 1)
     - Implementasi Drizzle: `LIKE '%"<nomor>"%'` pada kolom JSON maupun `=` untuk baris legacy (string polos)

#### 4. `core/usecase/contact_service.ts` [L79-91]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)

- **Singleton pattern** — `ContactService.getInstance()`
- **Use cases:**
  - `createContact` — Buat kontak baru dengan validasi
  - `contact` — Ambil kontak by ID + validasi ownership
  - `contacts` — Ambil semua kontak milik user
  - `updateContact` — Update kontak dengan validasi
  - `deleteContact` — Hapus kontak + validasi ownership
  - `mergeContacts(userId, phone)` — Gabungkan kontak yang berbagi nomor sama
  - `importFromFile` — Import kontak dari file CSV/VCF dengan merge logic

#### 5. `adapters/driven/drizzle/contact.repository.ts` [L92-99]

[`services/domain/contacts/adapters/driven/drizzle/contact.repository.ts`](./adapters/driven/drizzle/contact.repository.ts)

- Implementasi `ContactRepository` menggunakan **Drizzle ORM** + **SQLite (D1)**
- Query dasar dengan filter `userId` dan `id`
- Mapping kolom database (`userId` ↔ `ID`, nullable fields)

#### 6. `adapters/driving/graphql/contact.gql` [L100-105]

- **Query**: `contact(id)` — cari kontak by ID, `contacts` — list semua kontak user
- **Mutation**: `createContact(input)`, `updateContact(id, input)`, `deleteContact(id)`, `importContacts(content, filename)`, `mergeContacts(phone)`
- `Contact.phone` (String) = nomor pertama, `Contact.phones` ([String!]) = daftar semua nomor (maks 10)
- `mergeContacts(phone)` → `MergeResult { merged: Int, primary: Contact }`
- Semua query/mutation dilindungi directive `@authorized`

#### 7. `adapters/driving/graphql/contact.resolver.ts` [L106-114]

[`services/domain/contacts/adapters/driving/graphql/contact.resolver.ts`](./adapters/driving/graphql/contact.resolver.ts)

- Resolver yang menghubungkan GraphQL schema ke `ContactService`
- Transformasi hasil dari entity ke GraphQL response shape
- Konversi `ID` → `toHash` untuk response
- Validasi `userAuth` di setiap resolver

#### 8. `contact.composition.ts` [L115-121]

[`services/domain/contacts/contact.composition.ts`](./contacts.composition.ts)

- **Wiring**: Inisialisasi `ContactRepositoryImpl` + `ContactService.getInstance()`
- Export singleton `contactService` yang digunakan module lain

#### 9. `index.ts` [L122-129]

[`services/domain/contacts/index.ts`](./index.ts)

- Export `contactService` dan `ContactType` untuk digunakan module lain

---

### Use Cases [L130-250]

#### `createContact(name, userId, email?, phone?, group?, avatar?)` — Buat kontak baru [L132-155]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 29:46)

```ts
async createContact(
  name: string,
  userId: ID,
  email?: string,
  phones?: string | string[],
  group?: string,
  avatar?: string,
): Promise<Contact>
```

    > `Contact.new({ name, email, phones, group, avatar, userId }).validateAll()`
    >
    > > validasi gagal → `Error`
    > > validasi berhasil → `contactRepo.save(userId.toNumb, contact)`
    > > `contact.id` undefined → `Error` ("no id returned")
    > > `contact.id` defined → `return contact`

---

#### `contact(userId, contactId)` — Ambil kontak by ID [L156-171]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 49:58)

```ts
async contact(userId: ID, contactId: ID): Promise<ContactType>
```

    > `contactRepo.findById(userId.toNumb, contactId.toNumb)`
    >
    > > `null` → `NotFoundError`
    > > `contact.userId.toNumb !== userId.toNumb` → `NotFoundError`
    > > `contact` ditemukan → `return contact`

---

#### `contacts(userId)` — Ambil semua kontak user [L172-185]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 61:63)

```ts
async contacts(userId: ID): Promise<ContactType[]>
```

    > `contactRepo.findAll(userId.toNumb)`
    >
    > > `return Contact[]`

---

#### `updateContact(userId, contactId, data)` — Update kontak [L186-211]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 66:80)

```ts
async updateContact(
  userId: ID,
  contactId: ID,
  data: { name?: string; email?: string; phone?: string; group?: string },
): Promise<ContactType>
```

    > `contact(userId, contactId)` — validasi eksistensi + ownership
    >
    > > `NotFoundError`
    > > `Contact` ditemukan
    > > `data.name` → `existing.name = data.name`
    > > `data.email` → `existing.email = data.email`
    > > `data.phone` → `existing.phone = data.phone`
    > > `data.group` → `existing.group = data.group`
    > > `existing.validateAll()`
    > > `contactRepo.update(userId.toNumb, existing)`
    > > `return Contact`

---

#### `deleteContact(userId, contactId)` — Hapus kontak [L212-227]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 83:86)

```ts
async deleteContact(userId: ID, contactId: ID): Promise<void>
```

    > `contact(userId, contactId)` — validasi eksistensi + ownership
    >
    > > `NotFoundError`
    > > `Contact` ditemukan → `contactRepo.delete(userId.toNumb, contactId.toNumb)`
    > > `return void`

---

#### `mergeContacts(userId, phone)` — Gabungkan kontak dengan nomor yang sama

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 89)

```ts
async mergeContacts(userId: ID, phone: string): Promise<{ merged: number; primary: Contact }>
```

    > `phone.trim()` kosong → `ValidationError`
    >
    > `contactRepo.findByPhone(userId.toNumb, phone)` — fetch semua kontak yang punya nomor tsb
    >
    > > tidak ada → `NotFoundError`
    > > ada 1 saja → `{ merged: 0, primary }`
    >
    > ambil kontak pertama sebagai `primary`, sisanya `duplicates`
    >
    > gabungkan semua `phones` duplicate ke `primary` (dedupe via `Set`)
    >
    > `combined > MAX_PHONES` → `ValidationError`
    >
    > hapus setiap duplicate → `contactRepo.delete()` → `merged++`
    >
    > `primary.phones` berubah → `validateAll()` → `contactRepo.update()`
    >
    > `return { merged, primary }`

---

#### `importFromFile(userId, file)` — Import kontak dari file [L228-250]

[`services/domain/contacts/app/use-cases/contact_service.ts`](./app/use-cases/contact_service.ts)(line 89:142)

```ts
async importFromFile(userId: ID, file: File): Promise<{ imported: number; failed: number; merged: number }>
```

    > `file.text()` → baca file
    >
    > > `ext === "vcf"` → `parseVCF(text)`
    > > `ext === "csv"` → `parseCSV(text)`
    > > `contactRepo.findAll(userId.toNumb)` — ambil kontak existing
    > > buat `existingMap` dari nama contact
    > > loop setiap contact dari file
    > > `item.name` kosong → `failed++`, continue
    > > `existing` ditemukan → merge field yang berubah → `contactRepo.update()` → `merged++`
    > > `existing` tidak ditemukan → `createContact()` → `imported++`
    > > `catch` → `failed++`
    > > `return { imported, failed, merged }`

---

### Alur Kerja (Data Flow) [L251-294]

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request masuk via GraphQL                                    │
│    (contact.gql → contact.resolver.ts)                          │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth middleware validasi token (@authorized directive)       │
│    → inject context: { contact, userAuth }                     │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Resolver panggil ContactService (use case layer)           │
│    contact.resolver.ts → contact_service.ts                     │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ContactService jalankan business logic:                       │
│    - Validasi input (Zod schema di entity)                      │
│    - Cek ownership (userId matching)                            │
│    - Import file: parse CSV/VCF + merge logic                   │
│    - Panggil repository interface                               │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ContactRepositoryImpl (driven adapter) eksekusi DB query   │
│    - Drizzle ORM → SQLite D1                                    │
│    - Mapping row → Contact entity                               │
└──→──────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response balik via resolver → GraphQL client                │
└──→───────────────────────────────────────────────────────────────┘
```

---

### Catatan Arsitektur [L295-301]

- Module ini mengikuti **Vertical Slice per Module (Modular Hexagonal)**
- **Ports & Adapters**: Repository interface di `core/ports/out`, implementasi di `adapters/driven`
- **Dependency Injection**: Melalui `contact.composition.ts` — singleton diinisialisasi saat app startup
- **File Import**: Mendukung import dari CSV dan VCF dengan merge logic (update jika nama sama)
- **Ownership Validation**: Semua operasi memverifikasi bahwa contact belongs to authenticated user
