---
name: Structure Data Services
describe: Menjelaskan structure dirs,files,architecture,validation,dll
---

# Services — Architecture & Rules

Full-stack finance management. Backend: **Elysia + GraphQL Yoga** on Cloudflare Workers. Frontend: **SvelteKit**. DB: **Cloudflare D1 + Drizzle ORM**.

## Entry Points

- `app.ts` — Elysia server entry (Workers/Bun), mount Yoga at `/graphql`
- `server.ts` — Elysia server entry (Node.js standalone, port 3001)
- `composition/root.container.ts` — Master DI composition root

---

## Struktur Direktori

```
./
├── domain/
│   ├── {domain}/
│   │   ├── index.ts                   # Satu-satunya pintu publik modul ini
│   │   ├── {domain}.composition.ts    # Composition root: class Service + factory + singleton
│   │   ├── core/
│   │   │   ├── model/                 # Domain model: entity + aturan (Zod + class)
│   │   │   │   ├── {domain}.model.ts  # Entity: identitas + invariant
│   │   │   ├── usecase/               # Use case (satu file per use case)
│   │   │   ├── value-objects/         # Value objects (Balance, Token, logger, dll)
│   │   │   └── ports/out/             # Outbound ports (abstract repository contracts)
│   │   └── adapters/
│   │       ├── driven/                # Output adapters (persistence, external API)
│   │       │   ├── drizzle/           # Implementasi port (Drizzle/D1)
│   │       │   │   └── {domain}.repository.ts
│   │       │   └── {service}/         # External API adapter (mis. payment-gateway)
│   │       └── driving/               # Input adapters (HTTP, GraphQL)
│   │           └── graphql/
│   │               ├── {domain}.gql
│   │               └── {domain}.resolver.ts
│   └── {domain2}/                    # Struktur identik
│
├── shared/
│   ├── kernel/                       # Cross-module value objects & utilities
│   │   ├── id.ts                     # ID class (sqids-based hash)
│   │   ├── password-utils.ts         # Argon2 hash/verify
│   │   ├── cookies.ts                # Cookie parsing & serialization
│   │   ├── csrf.ts                   # HMAC-SHA256 CSRF token
│   │   ├── is-mybe.ts                # Null/undefined check
│   │   ├── errors/
│   │   │   └── service-error.ts      # Error hierarchy (ServiceError base)
│   │   └── uow.port.ts               # UnitOfWork abstract class
│   └── infra/                        # Infrastructure layer
│       ├── logger/
│       │   └── index.ts              # Logger singleton + LogLevel + streamLog
│       ├── decorators/
│       │   └── logger-decorator.ts   # @logMethod decorator
│       ├── db/
│       │   ├── index.ts              # re-exports getDB, getD1, useD1
│       │   ├── client.ts             # D1 / node-sqlite client
│       │   └── drizzle-schema/       # Centralized table schemas
│       │       ├── index.ts
│       │       ├── user.schema.ts
│       │       ├── token.schema.ts
│       │       ├── asset.schema.ts
│       │       ├── asset_mutation.schema.ts
│       │       ├── contact.schema.ts
│       │       ├── product.schema.ts
│       │       ├── transaction.schema.ts
│       │       ├── setting.schema.ts
│       │       └── relations.ts
│       └── graphql/
│           ├── directives.ts         # @authorized directive
│           ├── scalars/
│           │   └── date-time-or-timestamp.ts
│           ├── yoga-context.ts       # Per-request context factory
│           ├── yoga-server.ts        # Elysia + GraphQL Yoga setup
│           └── types/                # Codegen-generated types
│               ├── types.generated.ts
│               └── operations.generated.ts
│
├── composition/
│   └── root.container.ts             # Import semua modul, trigger init
│
├── tests/                            # Unit & integration tests lintas modul
│
├── app.ts                            # Elysia entry (Cloudflare Workers)
└── server.ts                         # Standalone Elysia server (port 3001)
```

### Prinsip Vertical Slice

- **Nambah modul baru = copy pattern** — tinggal tiru struktur `user/` atau `contact/`. `root.container.ts` cuma nambah 1 baris import.
- **Boundary dijaga lewat `index.ts`** (barrel export). Modul lain atau `routes/` cuma boleh import dari `index.ts`, tidak boleh reach langsung ke `domain/user/core` dari luar.
- **Cross-module communication** — panggil service/use-case yang diexport `index.ts`-nya, jangan import internal modul lain langsung.
- **`shared/kernel`** cuma buat value object generik lintas modul (Id, errors, uow), bukan tempat sampah.
- **Domain model menyatu di `core/model/`**: identitas, invariant, dan class domain hanya ada di `core/model/{domain}.model.ts`. Tidak ada lagi folder `core/entity/`. `core/` tidak boleh punya dependency ke Drizzle/persistence.
- **Adapter = implementasi port**: isi `adapters/` HANYA implementasi konkret dari port di `core/ports/out/` (repository Drizzle, payment gateway, resolver GraphQL). Tidak ada definisi domain/persistence di dalam adapter.

---

## Module Structure (Hexagonal per Module)

> **Domain, Model, dan Entity** adalah tiga konsep inti dalam arsitektur backend yang sering dipakai dalam Domain Driven Design (DDD) maupun Clean Architecture. Singkatnya: **domain** = ruang masalah bisnis, **model** = representasi logika bisnis, **entity** = representasi data dengan identitas unik.

### 🏛 Definisi Utama

- **Domain**
  - Ruang lingkup masalah bisnis yang sedang diselesaikan.
  - Berisi aturan, bahasa, dan proses yang relevan dengan konteks tertentu.
  - Contoh: E-commerce domain mencakup order, pembayaran, inventori, dan pengiriman.

- **Model**
  - Abstraksi dari konsep bisnis dalam kode.
  - Bisa berupa business model atau domain model.
  - Tidak hanya menyimpan data, tapi juga logika bisnis (misalnya validasi, perhitungan, workflow).
  - Contoh: `RiskLevel { min, max, isWithinRange(score) }`.

- **Entity**
  - Objek dengan identitas unik (biasanya primary key).
  - Digunakan untuk representasi data di database.
  - Dikelola oleh ORM (misalnya Hibernate, JPA, EF Core).
  - Contoh: `OrderEntity { id, userId, totalAmount }`.

### 📊 Perbandingan Domain, Model, Entity

| Aspek     | Domain                    | Model                        | Entity                           |
| --------- | ------------------------- | ---------------------------- | -------------------------------- |
| Fokus     | Ruang masalah bisnis      | Logika bisnis & aturan       | Data persistence (database)      |
| Bentuk    | Konsep, aturan, bahasa    | Class dengan data + behavior | Class dengan field → kolom tabel |
| Identitas | Tidak selalu ada          | Bisa ada, tergantung konteks | Selalu ada (ID unik)             |
| Contoh    | Order, Payment, Inventory | RiskLevel, DiscountRule      | OrderEntity, UserEntity          |

### 📌 Contoh Praktis

- **Entity (drizzle/TypeScript)**

  ```ts
  import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";

  export const orders = sqliteTable("orders", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    orderDate: text("order_date").notNull(),
    totalAmount: real("total_amount").notNull(),
  });

  export type OrderEntity = typeof orders.$inferSelect;
  ```

  → Hanya menyimpan data, langsung mapping ke tabel `orders`.

- **Model (Domain Logic)**

  ```ts
  export class RiskLevel {
    constructor(
      private min: number,
      private max: number,
    ) {}

    isWithinRange(score: number): boolean {
      return score >= this.min && score <= this.max;
    }
  }
  ```

  → Selain menyimpan data, juga punya behavior untuk validasi skor.

- **Domain (Konsep Bisnis)**
  - Order = proses pembelian barang.
  - Payment = aturan pembayaran (misalnya validasi kartu kredit).
  - Inventory = stok barang dan aturan pengurangan stok.

### ⚠️ Risiko & Trade-off

- **Entity terlalu kompleks** → Jika dimasukkan logika bisnis, bisa melanggar prinsip separation of concerns.
- **Model anemic** → Jika model hanya berisi data tanpa behavior, logika bisnis tercecer di service, membuat kode sulit dirawat.
- **Domain tidak jelas** → Bisa menyebabkan sistem tidak konsisten dengan kebutuhan bisnis.

### 🎯 Kesimpulan

- **Domain** = ruang masalah bisnis.
- **Model** = representasi logika bisnis.
- **Entity** = representasi data di database.

Dalam arsitektur modern, ketiganya dipisahkan agar sistem lebih terstruktur, scalable, dan mudah dirawat.

---

Setiap module di `domain/<module>/` memiliki struktur yang **WAJIB**:

```text
<module>/
  index.ts                      — export { service, Service, createService, Type } (module public surface)
  <module>.composition.ts       — Composition root: class <Module>Service + create<Module>Service() + singleton
  core/
    model/                      — domain model: identitas + aturan (tanpa dependency Drizzle)
      <module>.model.ts         — Zod schema + Entity class + validasi
    usecase/                    — use case bisnis
      <module>.usecase.ts       — Workflow / aturan proses bisnis
    value-objects/
      logger.ts                 — Module-scoped logger instance
    ports/out/
      <module>-repository.port.ts  — Abstract class (port interface)
  adapters/
    driving/graphql/
      <module>.gql              — SDL file (.gql?raw)
      <module>.resolver.ts      — Resolvers typed Resolvers<YogaContext>
    driven/drizzle/
      <module>.repository.ts    — Implementasi port repository (Drizzle/D1)
    driven/<pendukung>/         — adapter eksternal lain (mis. payment-gateway/)
```

> **Entity milik `core/`, bukan adapter**: satu-satunya tempat definisi Zod schema dan
> Domain model (Zod schema + Entity class) ada di `core/model/<module>.model.ts`. Definisi tabel Drizzle
> (`sqliteTable`) tetap di `shared/infra/db/drizzle-schema/`. Adapter HANYA flesibel:
> mengimplementasikan abstract class dari `core/ports/out/` (repository, gateway) atau
>menjawab permintaan dari core (resolver). `core/` tidak boleh meng-import driver DB.

### 9 Modules

| Module           | Entity                                    | Service Dependencies                               |
| ---------------- | ----------------------------------------- | -------------------------------------------------- |
| **auth**         | Token (JWT VO)                            | userService, authRepo, settingService              |
| **user**         | User                                      | userRepo                                           |
| **assets**       | Asset, AssetMutation, Balance (dinero.js) | assetRepo, uow                                     |
| **contacts**     | Contact                                   | contactRepo                                        |
| **products**     | Product (price, capital, margin)          | productRepo                                        |
| **transactions** | Transaction (income/expense/transfer)     | transactionRepo                                    |
| **setting**      | Setting (currency, darkMode)              | settingRepo                                        |
| **statistic**    | StatisticData (type-only)                 | statisticRepo                                      |
| **order**        | Order (saga rollback)                     | orderRepo (orchestrates product/transaction/asset) |

---

## Cross-Cutting Patterns (WAJIB diikuti)

### Entities (`adapters/driven/drizzle/`)

Entity class menggunakan **ES private fields** (`#field`) dengan `private constructor` + `static new()` factory. Zod schema sebagai single source of truth untuk validasi data.

```ts
// domain/assets/core/model/asset.model.ts
import { z } from "zod";

export const assetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["bank", "ewallet", "cash", "crypto", "loan"]),
});

export type AssetInput = z.input<typeof assetSchema>;
export type AssetData = z.output<typeof assetSchema>;

export class Asset {
  #id?: number;
  #name: string;
  #type: string;
  #balance: Balance;

  private constructor(data: AssetData & { balance: Balance }) {
    this.#name = data.name;
    this.#type = data.type;
    this.#balance = data.balance;
  }

  get name(): string {
    return this.#name;
  }
  get type(): string {
    return this.#type;
  }
  get metadata() {
    return { name: this.#name, type: this.#type, balance: this.#balance.value.toString() };
  }

  static new(input: AssetInput & { balance: Balance }): Asset {
    const result = assetSchema.safeParse(input);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return new Asset({ name: input.name, balance: input.balance, type: input.type });
  }
}
```

**Aturan Entity**:

- Zod schema dulu, **infer** type via `z.input<>` / `z.output<>` — jangan tulis manual
- Export `{domain}Input` dan `{domain}Data` (data-only, tanpa methods)
- Field schema di-derive dari `.shape` untuk validasi individual
- `private constructor` + `static new()` factory dengan `safeParse` untuk validasi
- Semua field sebagai `#private` dengan `getter` untuk akses read-only
- Gunakan Value Object class untuk konsep domain yang kompleks (contoh: `Balance`, `Token`)

### Singleton Service

```ts
export class SomeService {
  static #instanceSomeService: SomeService; // #instance HARUS unik per class (Bun bundler)
  #repo: SomeRepository;

  @logMethod(logger)
  static init(repo: SomeRepository): SomeService {
    SomeService.#instanceSomeService = new SomeService(repo);
    return SomeService.#instanceSomeService;
  }

  @logMethod(logger)
  static getInstance(repo?: SomeRepository): SomeService {
    if (repo) SomeService.#instanceSomeService = new SomeService(repo);
    if (!SomeService.#instanceSomeService) throw new Error("not initialized");
    return SomeService.#instanceSomeService;
  }

  private constructor(repo: SomeRepository) {
    this.#repo = repo;
  }
}
```

> **Catatan Bun bundler**: Nama `#instance` HARUS unik per class (`#instanceNamaService`) — Bun transpile `#private` menjadi `var _instance = new WeakMap` dan bundle semua module ke satu scope, sehingga nama variable bentrok bila sama.

### Value Objects (`core/value-objects/`)

Untuk value object dengan logika bisnis, buat class terpisah:

```ts
// domain/assets/core/value-objects/balance.vo.ts
import { add, dinero, subtract, type Dinero } from "dinero.js";
import * as _Currencies from "dinero.js/currencies";

export class Balance {
  #value!: Dinero<number, IsoCodeType>;

  private constructor() {}

  get value(): number {
    return this.#value.toJSON().amount;
  }

  get code(): IsoCodeType {
    return this.#value.toJSON().currency.code;
  }

  static new(value: string): Balance {
    const b = new Balance();
    let v = value.trim().split(" ") as [string, string];
    let [isoCode, _value] = v;
    b.#value = dinero({ amount: parseFloat(_value), currency: _Currencies[isoCode], scale: 0 });
    return b;
  }

  subtract(value: Balance) {
    this.#value = subtract(this.#value, value.#value);
  }
  add(value: Balance) {
    this.#value = add(this.#value, value.#value);
  }
}
```

### Port Interface (Abstract Class) — `core/ports/out/`

Abstract class untuk repository contracts — method return entity Data types (bukan class instance):

```ts
// domain/assets/core/ports/out/asset-repository.port.ts
export abstract class AssetRepository {
  abstract save(asset: AssetData): Promise<AssetData>;
  abstract findAll(): Promise<(AssetData & { balance: Balance })[]>;
  abstract findByName(name: string): Promise<(AssetData & { balance: Balance }) | null>;
  abstract update(name: string, data: Partial<AssetData>): Promise<AssetData>;
  abstract delete(name: string): Promise<void>;
}
```

### Use Cases (`core/usecase/`)

Satu file per use-case, bukan 1 service class besar. Gunakan singleton pattern via composition root.

```ts
// domain/assets/core/usecase/create-asset.usecase.ts
import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import type { AssetRepository } from "../ports/out/asset-repository.port";
import { Balance } from "../value-objects/balance.vo";
import { Logger, LogLevel } from "$services/shared/infra/logger";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";

const logger = Logger.create(LogLevel.Info, ".logger/asset-service-log.log", "CreateAssetUseCase");

export class CreateAssetUseCase {
  static #instanceCreateAssetUseCase: CreateAssetUseCase;
  #assetRepo: AssetRepository;

  @logMethod(logger)
  static init(assetRepo: AssetRepository): CreateAssetUseCase { ... }

  @logMethod(logger)
  static getInstance(): CreateAssetUseCase { ... }

  private constructor(assetRepo: AssetRepository) {
    this.#assetRepo = assetRepo;
  }

  @logMethod(logger)
  async execute(input: AssetInput & { initialBalance: Balance }): Promise<Asset> {
    const asset = Asset.new({ name: input.name, balance: input.initialBalance, type: input.type });
    await this.#assetRepo.save(asset.metadata);
    return asset;
  }
}
```

Atau untuk use-case sederhana, bisa export function langsung (tanpa class):

```ts
// domain/user/core/usecase/create-user.usecase.ts
import type { UserRepository } from "../ports/out/user-repository.port";

export function createUserUseCase(repo: UserRepository) {
  return async (input: UserInput) => {
    // logic
  };
}
```

**Rules untuk penamaan use-case:**

| Kategori | Method                       | Keterangan        |
| -------- | ---------------------------- | ----------------- |
| Mutasi   | `create-{domain}.usecase.ts` | Create entity     |
| Mutasi   | `update-{domain}.usecase.ts` | Update entity     |
| Mutasi   | `delete-{domain}.usecase.ts` | Delete entity     |
| Query    | `get-{domain}.usecase.ts`    | Get single by ID  |
| Query    | `list-{domain}s.usecase.ts`  | List all / filter |

### Base Use Case + Container (Auto-Inject) (wajib untuk use case baru)

Semua use case **WAJIB extends `CoreUsecase`** dari `$services/shared/base/core-usecase.base` dan dependency di-inject otomatis dari `ServiceContainer` (`$services/shared/base/service-container.base`). Pemanggilan dependency cukup **dengan nama class saja** via `this.deps.get(SomeClass)` — tidak perlu import instance/singleton.

```ts
// shared/base/service-container.base.ts (implementasi ada di folder tersebut)
type ServiceKey = abstract new (...args: never[]) => unknown;

class ServiceContainer {
  set<T>(ctor: abstract new (...args: never[]) => T, instance: T): this;
  get<T>(ctor: abstract new (...args: never[]) => T): T; // throw RequiredErr jika belum di-set
  has(ctor: ServiceKey): boolean;
}

// shared/base/core-usecase.base.ts
interface CoreUsecaseInterface<TOutput, TInput = void> {
  execute(input: TInput): Promise<TOutput>;
}

abstract class CoreUsecase<TOutput, TInput = void> implements CoreUsecaseInterface<
  TOutput,
  TInput
> {
  setContext(container: ServiceContainer): this;
  setContext(cb: (container: ServiceContainer) => void): this;
  protected get deps(): ServiceContainer; // auto-inject container
  abstract execute(input: TInput): Promise<TOutput>;
}
```

Contoh penyusunan use case dengan container (diambil dari `change-phase2.md`):

```ts
import type { AssetRepository } from "../ports/out/asset-repository.port";
import {
  Asset,
  type AssetType,
  type AssetInput,
  type AssetData,
  type AssetUpdate,
} from "./asset.model";
import { Balance } from "../value-objects/balance.vo";
import { ID, isMybe } from "$services/shared/kernel";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";
import type {
  AssetMutationInput,
  AssetMutationData,
} from "./asset-mutation.model";
import { CoreUsecase, ServiceContainer } from "$services/shared/base";

// Token untuk repository (class yang implement interface dependency)
class GetCtx implements AssetRepository {
  save(_asset: AssetData & { balance: Balance }, _tx?: unknown): Promise<Asset | null> {
    throw new Error("Method not implemented.");
  }
  findAll(_userId: ID, _tx?: unknown): Promise<Asset[]> {
    throw new Error("Method not implemented.");
  }
  findByName(_name: string, _userId: ID, _tx?: unknown): Promise<Asset | null> {
    throw new Error("Method not implemented.");
  }
  findById(_userId: ID, _assetId: ID, _tx?: unknown): Promise<Asset | null> {
    throw new Error("Method not implemented.");
  }
  update(_userId: ID, _id: number, _data: AssetUpdate, _tx?: unknown): Promise<Asset> {
    throw new Error("Method not implemented.");
  }
  delete(_name: string, _userId: ID, _tx?: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
  createAssetMutation(
    _assetId: ID,
    _data: AssetMutationInput,
    _tx?: unknown,
  ): Promise<AssetMutationData> {
    throw new Error("Method not implemented.");
  }
  findMutationsByAssetId(_assetId: ID, _userId: ID): Promise<AssetMutationData[]> {
    throw new Error("Method not implemented.");
  }
}

// Command input type
interface MutateAssetInput {
  userId: AssetInput["userId"];
  name: AssetInput["name"];
  type: AssetType;
  balance: string;
}

// Concrete use case: extends CoreUsecase + akses dep via this.deps.get(GetCtx)
class MutateAssetService extends CoreUsecase<string, MutateAssetInput> {
  async execute(input: MutateAssetInput): Promise<string> {
    const assetRepo = this.deps.get(GetCtx);
    const balance = Balance.new(input.balance);
    const asset = Asset.new({
      userId: input.userId,
      name: input.name,
      type: input.type,
      balance,
    }).requiredAll();
    const result = await assetRepo.save({
      name: asset.name,
      type: asset.type,
      balance,
      userId: asset.userId,
    });
    if (isMybe(result)) throw new Error("Failed to create asset");
    return result!.IdStr;
  }
}

// Composition root: setContext auto-inject, panggil cukup nama class (GetCtx)
const _ = new MutateAssetService().setContext((container) => {
  container.set(GetCtx, new AssetRepositoryImpl());
});
```

**Aturan:**

3. Dependency use case diambil dari container, bukan constructor/field langsung.
4. Token `GetCtx` (class kosong yang `implements` port) dipakai sebagai key — class apa pun yang sudah ter-register bisa langsung `this.deps.get(ClassName)`.
5. Use case dibuat via `new UseCase().setContext(container)`; `setContext` menerima `ServiceContainer` atau callback registrasi.
6. `get()` melempar `RequiredErr` jika dependency belum diregistrasi (fail-fast DI).

### Repository Implementation (`adapters/driven/drizzle/`)

Concrete implementation class `implements` abstract port dari `core/ports/out/`:

```ts
import { eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { someTable } from "$services/shared/infra/db/drizzle-schema";

export class SomeRepositoryImpl implements SomeRepository {
  async findAll(userId: number) {
    const rows = await getDB().select().from(someTable).where(eq(someTable.user_id, userId));
    return rows.map((r) => SomeEntity.new(r));
  }
}
```

Pisahkan mapping logic ke mapper (pattern opsional):

```ts
// domain/assets/adapters/driven/drizzle/asset.mapper.ts
export function toDomain(row: typeof assetTable.$inferSelect): Asset { ... }
export function toDrizzle(asset: Asset): typeof assetTable.$inferInsert { ... }
```

### GraphQL Integration

#### Schema (`adapters/driving/graphql/{domain}.gql`)

SDL type + input, langsung ter-generate ke `types.generated.ts`:

```graphql
type Query {
  assets: [Asset!]! @authorized
  asset(name: String!): Asset @authorized
}
type Mutation {
  createAsset(input: CreateAssetInput!): Asset! @authorized
}
type Asset {
  name: String!
  type: AssetType!
  balance: String!
}
```

#### Resolver (`adapters/driving/graphql/{domain}.resolver.ts`)

Gunakan `Resolvers<YogaContext>` dari generated types. Akses use-case/service via context (bukan import langsung):

```ts
// domain/assets/adapters/driving/graphql/asset.resolver.ts
import type { Resolvers, AssetType } from "$gql/types.generated";
import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { Balance } from "../../core/value-objects/balance.vo";
import typeDefs from "./asset.gql?raw";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    assets: async (_parent, _args, { asset }) => {
      const assets = await asset.findAll();
      return assets.map(({ balance, name, type }) => ({ balance, name, type: type as AssetType }));
    },
  },
  Mutation: {
    createAsset: async (_parent, args, { asset }) => {
      const balance = Balance.new(args.input.balance);
      const result = await asset.create({
        name: args.input.name,
        type: args.input.type as AssetType,
        initialBalance: balance,
      });
      return { ...result.metadata, type: result.type as AssetType };
    },
  },
};

export { typeDefs as assetTypeDefs };
export const assetResolvers = resolvers;
```

#### Schema Merge (`shared/infra/graphql/yoga-server.ts`)

Import typeDefs dan resolvers dari tiap modul (indah gaya `$services/`):

```ts
import {
  assetTypeDefs,
  assetResolvers,
} from "$services/domain/assets/adapters/driving/graphql/asset.resolver";
// ... modul lainnya
```

### Composition Root (`<module>.composition.ts`)

Satu file per module berisi **class service**, **factory** (untik test), dan **singleton produksi**. Tidak ada lagi folder `app/`: definisi service, adapter default, dan wiring use case hidup di file yang sama.

```ts
// domain/assets/assets.composition.ts
import { ServiceContainer } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { AssetRepositoryImpl } from "./adapters/driven/drizzle/asset.repository";
import { UnitOfWorkImpl } from "./adapters/driven/drizzle/uow.repository";
import { AssetRepository } from "./core/ports/out/asset-repository.port";
import { CreateAssetUseCase } from "./core/usecase/create-asset.usecase";
import { logger } from "./core/value-objects/logger";

export class AssetService {
  static #instanceAssetService: AssetService;
  #createAsset: CreateAssetUseCase;

  @logMethod(logger)
  static init(createAsset: CreateAssetUseCase): AssetService {
    AssetService.#instanceAssetService = new AssetService(createAsset);
    return AssetService.#instanceAssetService;
  }

  @logMethod(logger)
  static getInstance(): AssetService {
    if (!AssetService.#instanceAssetService) throw new Error("AssetService not initialized");
    return AssetService.#instanceAssetService;
  }

  private constructor(createAsset: CreateAssetUseCase) {
    this.#createAsset = createAsset;
  }

  @logMethod(logger)
  async createAsset(input: AssetInput): Promise<Asset> {
    return this.#createAsset.execute(input);
  }
}

export type AssetAdapters = {
  assetRepo: AssetRepository;
  uow: UnitOfWork;
  outboxRepo: OutboxRepository;
};

export function createAssetService({ assetRepo, uow, outboxRepo }: AssetAdapters): AssetService {
  const container = new ServiceContainer()
    .set(AssetRepository, assetRepo)
    .set(UnitOfWork, uow)
    .set(OutboxRepository, outboxRepo);

  const createAsset = new CreateAssetUseCase().setContext(container);
  // ... use case lain

  return AssetService.init(createAsset);
}

logger.info("Initializing AssetService...");
export const assetService = createAssetService({
  assetRepo: new AssetRepositoryImpl(),
  uow: new UnitOfWorkImpl(),
  outboxRepo: new OutboxRepositoryImpl(),
});
logger.info("AssetService initialized");
```

Aturan penting untuk composition:

- Class service **hanya** facade: field private `#useCase` + delegasi `this.#useCase.execute(...)`. Tidak ada query repository, tidak ada instantiate use case.
- `create<Module>Service(adapters)` adalah **seam untuk test** — test memanggil factory dengan mock port, tidak pernah `new RepoImpl()`.
- Singleton produksi (`export const <module>Service = create<Module>Service({...})`) selalu memakai adapter default (Drizzle/D1).
- **Circular import antar module**: kalau dua domain saling memakai service (assets↔transactions), jangan tangkap `export const service` di top-level. Resolvelate saat request, contoh `LazyAssetSwapGateway` di `transactions.composition.ts` yang memanggil `AssetService.getInstance()`.
- `EventBus.on(...)` di composition juga resolve service saat event terjadi, bukan saat module dievaluasi.
- `auth` memegang dua class (`AuthService` + `PasskeyService`) dalam satu file composition.
- Tipe kontrak lintas domain (mis. `AssetSwapGateway`, `SwapBalanceResult`) ditaruh di `core/ports/out/*.port.ts`, bukan di file service.

### Root Container (`composition/root.container.ts`)

Trigger init semua modul (import bernilai samping) + re-export service:

```ts
// composition/root.container.ts
import "$services/domain/user";
import "$services/domain/assets";
// ... semua modul

export { userService } from "$services/domain/user";
export { assetService } from "$services/domain/assets";
// ...
```

### Module Index (Barrel Export)

Satu-satunya pintu publik modul:

```ts
// domain/assets/index.ts
export {
  createAssetService,
  assetService,
  AssetService,
  type AssetAdapters,
} from "./assets.composition";
export type { AssetInput, AssetData } from "./core/model/asset.model";
export { Asset } from "./core/model/asset.model";
export { Balance } from "./core/value-objects/balance.vo";
```

Barrel selalu export dari `<module>.composition.ts` (class + factory + singleton). Tidak ada lagi re-export dari `app/`. Use case dari modul lain WAJIB meng-import lewat barrel (`$services/domain/assets`), bukan menembus ke `core/usecase/`.

---

## Shared Kernel (`shared/kernel/`)

| File                      | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `id.ts`                   | `ID` class — Sqids obfuscation (`.toHash()` / `.toNumb()`) |
| `password-utils.ts`       | Argon2id hash + verify (legacy PBKDF2 fallback)            |
| `csrf.ts`                 | HMAC-SHA256 CSRF token                                     |
| `cookies.ts`              | parse/serialize/delete cookie helpers                      |
| `uow.port.ts`             | Abstract `UnitOfWork.run(fn)`                              |
| `is-mybe.ts`              | Null/undefined check                                       |
| `errors/service-error.ts` | Error hierarchy — lihat di bawah                           |

### Errors (`shared/kernel/errors/`)

Semua error di satu tempat, hierarki; import via `$services/shared/kernel/errors/service-error`:

```
ServiceError (base)
├── ValidationError      (400)
├── NotFoundError        (404)
├── AuthenticationError  (401)
├── ConflictError        (409)
└── UnauthorizedError    (403)
```

(Lengkap: `RequiredErr` (422) juga tersedia.)

---

## Shared Infrastructure (`shared/infra/`)

| Area                 | Key Files                                                        | Purpose                                             |
| -------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `db/`                | `client.ts`, `d1-tx-collector.ts`                                | Drizzle + D1 client, D1 batch collector             |
| `db/drizzle-schema/` | `*.schema.ts`, `relations.ts`                                    | 9 table definitions + relations                     |
| `graphql/`           | `yoga-server.ts`, `yoga-context.ts`, `directives.ts`, `scalars/` | Yoga setup, context, @authorized directive          |
| `logger/`            | `index.ts`                                                       | Logger (colored, file in dev, levels) + `streamLog` |
| `cache/`             | `index.ts`                                                       | In-memory TTL cache                                 |
| `parser/`            | `index.ts`                                                       | CSV/VCF parsers                                     |
| `decorators/`        | `logger-decorator.ts`                                            | `@logMethod` decorator                              |

Drizzle Tables: `user`, `token`, `asset`, `asset_mutation`, `contact`, `product`, `transaction`, `setting`, `order`

---

## Path Aliases

| Alias         | Target                                    |
| ------------- | ----------------------------------------- |
| `$services`   | `./`                                      |
| `$services/*` | `./*`                                     |
| `$config`     | `./app.config.ts`                         |
| `$gql`        | `./shared/infra/graphql/types`            |
| `$gql/*`      | `./shared/infra/graphql/types/*`          |

---

## Codegen

Config di `codegen.ts` (repo root):

```ts
const config: CodegenConfig = {
  schema: "domain/**/*.gql",
  generates: {
    "./shared/infra/graphql/types/types.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
    },
  },
};
```

Jalankan: `bun run gql:gen` — **WAJIB** dijalankan setiap ada perubahan SDL (`.gql`), lalu `bun run check`.

---

## Testing

- Unit test per service/use-case di `tests/{domain}/` — mock repository port dengan `mock()` dari bun:test
- Test **WAJIB** memakai factory `create<Module>Service({ repo: mockRepo, ... })` untuk menyuntik adapter, bukan `new RepoImpl()` atau singleton produksi. Singleton global di-share antar file test dalam satu proses, jadi setiap integration test yang butuh service lain **WAJIB** memanggil factory-nya sendiri di `beforeAll`.
- Integration test dengan `D1Mock` (in-memory SQLite) + Elysia HTTP di `tests/`
- Run: `bun run test`

---

## Key Invariants (JANGAN dilanggar)

1. Setiap module **WAJIB** punya: `core/`, `adapters/`, `<module>.composition.ts`, `index.ts` — folder `app/` **DILARANG** (class service + factory + singleton tinggal di `<module>.composition.ts`)
2. Service class **WAJIB** singleton (`static #instance` + `init()`/`getInstance()`) dan **WAJIB** dideklarasikan di `<module>.composition.ts`
3. Semua public method service/use-case **WAJIB** dikasih `@logMethod(logger)`
4. Domain model **WAJIB** tinggal di `core/model/<module>.model.ts` (Zod schema + Entity class + `validate*()` chainable) — satu-satunya tempat definisi entity. Folder `core/entity/` **DILARANG**. Tabel Drizzle (`sqliteTable`) di `shared/infra/db/drizzle-schema/`
5. `core/` **DILARANG** meng-import `drizzle-orm`, `$services/shared/infra/db`, atau modul `adapters/` milik domain lain
6. Port **WAJIB** abstract class (bukan interface) di `core/ports/out/` — method return entity Data types
7. Isi `adapters/` **WAJIB** hanya implementasi port (`implements <X>Repository`) atau driving adapter (resolver) — tidak boleh mendefinisikan entity, schema, atau aturan bisnis
8. DILARANG ada class `XRules` yang menduplikasi `validate*()` milik domain model — aturan validasi hanya hidup di `core/model/{module}.model.ts`
9. Repository **WAJIB** implement abstract class dari `core/ports/out/` dan berada di `adapters/driven/drizzle/`
10. GraphQL resolver **WAJIB** pakai `Resolvers<YogaContext>` type
11. SDL **WAJIB** di-import via `import typeDefs from "./module.gql?raw"`
12. ID ke external **WAJIB** pake `ID.toHash()` (Sqids), internal pake `ID.toNumb()`
13. Money **WAJIB** pake `Balance` (dinero.js)
14. Jangan import `$services/` dari client code (`src/routes/`, `src/lib/`) — lihat `client-server-boundary` skill
15. Cross-module dependency hanya via services: `auth→user`, `order→product|transaction|asset`, `assets→transaction`
16. Komposisi module hanya di `<module>.composition.ts` — jangan impor repo/entity module lain secara langsung. Referensi service antar module yang membentuk siklus **WAJIB** resolve saat runtime (`Service.getInstance()` / lazy gateway), jangan tangkap `export const service` di top-level
17. **Barrel export**: /ts` modul — jangan tembus ke subfolder
18. **Cross-module via service/port**: kalau modul A butuh data modul B, lewat service yang diexport `index.ts`-nya
19. **`#instance` naming**: `#instanceNamaService` — UNIK per class (bentrok di Bun bundler)
20. **Use-case pattern**: 1 file = 1 use-case. Untuk kesederhanaan, boleh tetap 1 file service — namely class `<Domain>Service` di `<domain>.composition.ts`
21. **Mapper terpisah** (opsional): jangan campur mapping logic di repository
22. **Resolver akses via context**: gunakan service yang di-inject di `YogaContext`, bukan import langsung
