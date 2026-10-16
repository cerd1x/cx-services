---
name: graphql-scalars DateTime & Timestamp
description: Panduan penggunaan `graphql-scalars` `DateTime` dan `Timestamp` scalar di project ini, termasuk definisi type, registrasi resolver, codegen config, dan pola di resolver.
---

## Instalasi

```bash
bun add graphql-scalars
```

## Definisi Scalar

Tambahkan scalar ke typeDefs dan resolver ke resolvers di `services/graphql_yoga.ts`:

```ts
import { DateTimeResolver, TimestampResolver } from "graphql-scalars";

const scalarTypeDefs = `scalar DateTime
scalar Timestamp`;

let schema = makeExecutableSchema({
  typeDefs: [
    authorizedDirectiveTypeDefs,
    scalarTypeDefs, // <— scalar definitions
    authTypeDefs,
    // ...domain lainnya
  ],
  resolvers: [
    { DateTime: DateTimeResolver, Timestamp: TimestampResolver }, // <— scalar resolvers
    authResolvers,
    // ...domain lainnya
  ],
});
```

## Codegen Config (`codegen.ts`)

```ts
const config: CodegenConfig = {
  schema: ["services/core/**/*.gql", "scalar DateTime\nscalar Timestamp"],
  generates: { ... },
  config: {
    scalars: {
      DateTime: "Date",    // <— mapping ke Date object
      Timestamp: "number",  // <— mapping ke number
    },
  },
};
```

## Penggunaan di `.gql` File

```graphql
type Transaction {
  date: DateTime!
  createdAt: DateTime
  updatedAt: DateTime
  expiresAt: Timestamp # epoch dalam number
}

input TransactionFilter {
  startDate: DateTime!
  endDate: DateTime!
  before: Timestamp
}
```

## Penanganan di Resolver

### DateTime — ISO 8601

| Arah   | Input client             | Yang diterima resolver | Yang dikembalikan                                  |
| ------ | ------------------------ | ---------------------- | -------------------------------------------------- |
| Input  | `"2026-06-21T10:30:00Z"` | `Date` object          | —                                                  |
| Output | —                        | —                      | Return `Date`, otomatis di-serialize ke ISO string |

```ts
// ✅ Output — return Date langsung
{ createdAt: result.createdAt }

// ✅ Input — langsung pakai Date dari args
await transaction.getByDateRange(args.start, args.end);
await transaction.create({ date: args.input.date, ... });
```

### Timestamp — epoch number

| Arah   | Input client | Yang diterima resolver | Yang dikembalikan                                |
| ------ | ------------ | ---------------------- | ------------------------------------------------ |
| Input  | `1789852200` | `number`               | —                                                |
| Output | —            | —                      | Return `number`, otomatis di-serialize ke number |

```ts
// ✅ Output — return number langsung
{
  expiresAt: result.expiresAt;
}

// ✅ Input — langsung pakai number dari args
await session.validate(args.expiresAt);
```

## Ringkasan

| Scalar      | Format          | Input client             | Tipe resolver | Codegen type |
| ----------- | --------------- | ------------------------ | ------------- | ------------ |
| `DateTime`  | ISO 8601 string | `"2026-06-21T10:30:00Z"` | `Date`        | `Date`       |
| `Timestamp` | epoch number    | `1789852200`             | `number`      | `number`     |
