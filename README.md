# cx-services

Backend **berdiri sendiri** untuk ekosistem Cerdix: GraphQL API (GraphQL Yoga) di atas
Elysia, Drizzle ORM untuk D1 (Cloudflare), autentikasi JWT + WebAuthn/passkey, dan
beta-report (R2 + Email).

Project ini hasil pemisahan dari monorepo `cxapp` (sekarang `cx-web`); tidak ada lagi
dependensi ke SvelteKit maupun ke source `cx-web`.

```
cx-web  ──HTTP/GraphQL──▶  cx-services  ──▶  D1 / R2 / Email
cx-dompetqu ──HTTP/GraphQL──▶ cx-services
```

## Stack

| Bagian            | Teknologi                                            |
| ----------------- | ---------------------------------------------------- |
| HTTP              | Elysia + `@elysiajs/cors` + `elysia-rate-limit`      |
| GraphQL           | GraphQL Yoga + `@graphql-tools/schema`               |
| ORM / DB          | Drizzle ORM (`drizzle-orm/d1`) → Cloudflare D1        |
| Auth              | JWT (`jsonwebtoken`) + WebAuthn (`@simplewebauthn`) |
| Runtime           | Cloudflare Workers (`nodejs_compat`) atau Bun/Node  |
| Test              | `bun:test` (unit + integrasi D1Mock + e2e)           |

## Arsitektur (Hexagonal)

```
domain/            # 9 modul bisnis: assets, auth, contacts, order, payment,
                   # products, setting, statistic, transactions, user
│  core/           #   model, value-object, use-case, port (kontrak)
│  adapters/       #   driving (graphql) + driven (drizzle)
composition/       # root container / DI
shared/            # kernel, base, infra (db, graphql, logger, beta-report)
tests/             # unit, integrasi, e2e
```

Detail lengkap: [`AGENT.md`](./AGENT.md).

## Entry point

| File         | Runtime                    | Cara jalan                        |
| ------------ | -------------------------- | --------------------------------- |
| `worker.ts`  | Cloudflare Workers         | `bun run dev` / `wrangler deploy` |
| `server.ts`  | Bun / Node (butuh D1)      | `bun run dev:bun`                 |
| `app.ts`     | Elysia app + handler.fetch | dipakai `worker.ts`               |

`worker.ts` hanya *wiring binding* (D1, R2, Email) lalu meneruskan request ke Elysia app.

## Command

```bash
bun install

bun run dev            # wrangler dev (D1 + R2 lokal, port 8787)
bun run build          # bundel worker.ts -> build/worker.js (Bun)
bun run deploy         # build + wrangler deploy
bun run dev:bun        # server.ts (butuh globalThis.CX_DB)

bun run gql:gen        # generate shared/infra/graphql/types/types.generated.ts
bun run check          # type-check (tsgo)

bun run test           # semua test (unit + integrasi + e2e)
bun run test:e2e       # hanya e2e
bun run e2e:auth       # e2e per domain (auth, asset, contact, order, payment,
                       #   product, setting, statistic, transaction, user)

bun run db:generate    # drizzle-kit generate -> drizzle/
bun run db:migrate     # drizzle-kit migrate
bun run db:push        # drizzle-kit push
bun run db:studio      # drizzle-kit studio

bun run lint           # oxlint
bun run fmt            # oxfmt
```

## Konfigurasi

Salin `.env.example` → `.env` (Bun/Node) dan `.dev.vars.example` → `.dev.vars`
(`wrangler dev`). `wrangler.jsonc` menyimpan binding (`CX_DB`, `BETA_REPORT_R2`)
dan `vars` non-rahasia.

| Variabel                 | Wajib | Fungsi                                        |
| ------------------------ | ----- | --------------------------------------------- |
| `SECRET_KEY`             | ya    | tanda tangan JWT + HMAC challenge WebAuthn    |
| `ORIGIN`                 | ya*   | allowlist CORS (pisahkan dengan koma)          |
| `GQL_PATH`               | tidak | default `/graphql`                            |
| `CLOUDFLARE_*`           | tidak | kredensial `drizzle-kit` untuk D1 remote       |
| `BETA_REPORT_*`          | tidak | storage R2 + email + admin token               |

> `*` Wajib bila API diakses langsung dari browser (mobile/Flutter). Bila web
> selalu lewat reverse proxy same-origin (default `cx-web`), `ORIGIN` boleh kosong.

## Database

Skema Drizzle: `shared/infra/db/drizzle-schema/*.schema.ts`
Migrasi: `drizzle/` (drizzle-kit) dan `migrations/` (SQL mentah, arsip).

```bash
bun run db:generate     # generate SQL baru
wrangler d1 migrations apply cxapp-db --remote   # terapkan ke D1 production
```

## Integrasi dengan `cx-web`

`cx-web` tidak mengimpor kode dari project ini. Integrasi terjadi lewat HTTP:

- `cx-web` me-*forward* `/api/*` → `API_ORIGIN` (lihat `src/routes/api/[...slugs]/+server.ts`).
- Karena request tetap same-origin dari sisi browser, cookie sesi `__sst__` / `__rft__`
  tetap milik domain web dan passkey (`rpID`) tidak berubah.
- Type GraphQL sisi web di-generate dari SDL project ini:

  ```bash
  # di cx-web
  SERVICES_SDL_PATH=../cx-services/domain bun run gql:gen
  ```
