# Build Worker dengan Bun

Membangun `cx-services` (Elysia + GraphQL Yoga) menjadi satu bundle untuk Cloudflare Workers.

## Build

```bash
bun run build
```

Output: `build/worker.js`

`wrangler.jsonc` memakai `no_bundle: true`, jadi `bun run build` **wajib** dijalankan sebelum `bun run dev` / deploy.

## Dev lokal

```bash
bun run dev          # wrangler dev, worker di http://localhost:8787
```

Route:

- `GET /` — root
- `GET /health` — health check
- `POST /graphql` — GraphQL endpoint
- `POST /beta/report` — beta report (butuh `BETA_REPORT_ADMIN_TOKEN`)

## Deploy

```bash
bun run deploy
```

## Struktur

- `worker.ts` — entry point Worker (`fetch`, wiring D1/R2/Email ke `globalThis`)
- `app.ts` — Elysia app (`aot: false` wajib: Workers melarang `new Function`)
- `scripts/build.ts` — build script memakai `Bun.build()` dengan plugin custom untuk:
  - alias `$services`
  - `.gql?raw` imports (strip `?raw`, load `.gql` sebagai text)

## Catatan runtime Workers

- Tidak ada filesystem tulis → `Logger` otomatis menonaktifkan file log.
- Tidak ada `new Function`/`eval` → `aot: false` pada Elysia.
- Tidak ada env `NODE_ENV=development` dari `.dev.vars` bila production.