# Deploy cx-services ke Cloudflare Workers

Proyek ini adalah **Cloudflare Worker** (bukan Pages). Deploy memakai `wrangler deploy`.

## Prasyarat

```bash
bun install
bun run build     # output build/worker.js
```

> `wrangler.jsonc` memakai `no_bundle: true`, jadi build **wajib** dijalankan manual sebelum deploy.

## Deploy

```bash
bun run deploy
```

Setara dengan:

```bash
wrangler deploy
```

## Secret

```bash
wrangler secret put SECRET_KEY
wrangler secret put RESEND_API_KEY
```

List secret yang tersedia ada di `.dev.vars.example`. Nilai lokal memakai `.dev.vars` (gitignored).

## Scripts di `package.json`

| Script    | Perintah                                  |
| --------- | ----------------------------------------- |
| `build`   | `bun run scripts/build.ts`                |
| `dev`     | `wrangler dev`                            |
| `deploy`  | `wrangler deploy`                         |
| `db:...`  | Drizzle-kit migration (lihat README)      |

## Konfigurasi (`wrangler.jsonc`)

| Binding          | Tipe | Keterangan                          |
| ---------------- | ---- | ----------------------------------- |
| `CX_DB`          | D1   | database `cxapp-db`                |
| `BETA_REPORT_R2` | R2   | bucket `cxapp-beta-reports`         |

## Masalah Umum

### Secret belum di-set

**Error:** `Missing required secret` saat boot.

**Solusi:** `wrangler secret put <NAME>` atau isi `.dev.vars` untuk lokal.

### `Code generation from strings disallowed`

**Sebab:** Elysia AOT (TypeBox) memakai `new Function`, yang dilarang Workers.

**Solusi:** `aot: false` di `app.ts` — jangan dihapus.

### Build output tidak ada

**Error:** `Could not read "build/worker.js"`.

**Solusi:** `bun run build` sebelum `wrangler deploy` / `wrangler dev`.

### Endpoint lewat `cx-web`

`cx-web` mem-proxy `/api/*` → `API_ORIGIN`. Worker ini hanya melayani `/graphql`, `/health`, dan `/beta/*` — tidak ada prefix `/api`.