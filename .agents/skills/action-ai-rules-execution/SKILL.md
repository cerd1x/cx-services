---
name: action-ai-rules-execution
description: Rules for AI behavior when executing scripts and actions on the project. Use when running commands, scripts, or performing automated actions in the codebase.
---

# Action AI Rules Execution

Rules ketika AI menjalankan action/script pada project ini (`cx-services`).

## Rules

### 1. Selalu Paparkan Command Terlebih Dahulu

Sebelum menjalankan command apapun, AI **WAJIB** menampilkan command yang akan dijalankan dan menunggu konfirmasi user.

```
Command yang akan dijalankan: `bun run db:push`
Konfirmasi? (y/n)
```

### 2. Jangan Jalankan Command Secara Otomatis

- ❌ Tidak boleh langsung eksekusi command tanpa ijin user
- ❌ Tidak boleh menggabungkan beberapa command dalam satu run tanpa persetujuan
- ✅ Tunggu user konfirmasi setiap command satu per satu

### 3. Kategori Command & Aturan

| Kategori       | Contoh                                                         | Aturan                                                    |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| **Read-only**  | `bun run check`, `bun run lint`, `bun test`                    | Boleh sarankan, tetap minta konfirmasi                    |
| **Mutasi DB**  | `bun run db:push`, `bun run db:generate`, `bun run db:migrate` | **WAJIB** konfirmasi + jelaskan dampaknya                 |
| **Build**      | `bun run build`, `bun run gql:gen`                             | Minta konfirmasi, jelaskan output yang dihasilkan         |
| **Dev Server** | `bun run dev`                                                  | Jangan jalankan — biarkan user menjalankan sendiri        |
| **Deploy**     | `bun run deploy`                                               | **WAJIB** konfirmasi + pastikan build berhasil dulu       |
| **Install**    | `bun install`                                                  | Minta konfirmasi, jelaskan package yang ditambah/diupdate |

### 4. Urutan Eksekusi

Ketika task membutuhkan beberapa command, jalankan secara **berurutan dan terpisah**:

1. Jalankan command pertama → tunggu hasil
2. Jika berhasil, baru paparkan command berikutnya → tunggu konfirmasi user
3. Ulangi sampai selesai

Jangan skip urutan hanya karena command sebelumnya berhasil.

### 5. Handle Error dengan Benar

- Jika command gagal, **jangan langsung auto-fix** — paparkan error-nya dulu
- Jelaskan penyebab error secara singkat
- Tawarkan solusi, tapi tetap tunggu user pilih solusi mana yang dijalankan

### 6. Type Checking & Linting

- ketika ai melakukan execution pada project mu dalam mode development analisa maupun cek error maka gunakan:
- ✅ `bun run check` untuk type checking (`tsgo`)
- ✅ `bun run fmt` untuk format pada file `.{js,ts}`
- ✅ `bun run lint:fix` untuk linter pada file `.{js,ts}`
- ❌ Jangan pakai `rs:check` / `rs:fmt` (khusus SvelteKit, tidak ada di project ini)

### 7. Database Action

- `bun run db:generate` — generated migration file, **WAJIB** review isi migration sebelum push
- `bun run db:push` — langsung push schema ke DB, **WAJIB** pastikan generate dulu
- `bun run db:migrate` — jalankan migration yang sudah ada, **WAJIB** konfirmasi

### 8. GraphQL Codegen

- `bun run gql:gen` — hanya jalankan jika ada perubahan pada `.gql` files atau resolver types
- Selalu konfirmasi sebelum menjalankan

### 9. Script Custom

- Jika ada script di `scripts/`, **WAJIB** baca isi script dulu sebelum menjalankan
- Jangan jalankan script yang belum dibaca isinya
- Paparkan apa yang dilakukan script tersebut ke user

### 10. Environment Variables

- ❌ Jangan hardcode secrets atau API keys dalam command
- ❌ Jangan print environment variables yang sensitif
- ✅ Gunakan `.env` file untuk secrets
- ✅ Jika command butuh env tertentu, paparkan apa yang dibutuhkan tanpa value-nya

## Referensi Script yang Tersedia

| Script                     | Keterangan                                          | Kategori      |
| -------------------------- | --------------------------------------------------- | ------------- |
| `bun run dev`              | Jalankan dev server                                 | Dev Server    |
| `bun run build`            | Build production                                    | Build         |
| `bun run gql:gen`          | Generate GraphQL types                              | Build         |
| `bun run gql:watch`        | Watch & regenerate GraphQL types                    | Dev Server    |
| `bun run check`            | Type checking (svelte-check + tsgo)                 | Read-only     |
| `bun run lint`             | Linting dengan oxlint                               | Read-only     |
| `bun run lint:fix`         | Auto-fix lint                                       | Mutasi (file) |
| `bun run db:push`          | Push schema ke database                             | Mutasi DB     |
| `bun run db:generate`      | Generate migration file                             | Mutasi DB     |
| `bun run db:migrate`       | Jalankan migration                                  | Mutasi DB     |
| `bun run db:studio`        | Buka Drizzle Studio                                 | Dev Server    |
| `bun run deploy`           | Build & deploy Worker ke Cloudflare                  | Deploy        |
| `bun run dev:bun`          | Jalankan `server.ts` via Bun (host inject D1 manual) | Dev Server    |
| `bun run test`             | Semua test (unit + integration + e2e)               | Read-only     |
| `bun run test:unit`        | Unit + integration test                             | Read-only     |
| `bun run test:e2e`         | e2e GraphQL test                                    | Read-only     |
| `bun run e2e:<domain>`     | e2e runner per domain                               | Read-only     |

## Runtime Workers (Cloudflare)

- Workers tidak punya filesystem tulis → jangan mengel 기대kan `.logger/*.log` tercipta.
- Workers tidak punya `new Function`/`eval` → `aot: false` pada Elysia di `app.ts` wajib dipertahankan.
- Jangan ditunggu blocking: `bun run dev` berjalan di foreground. Gunakan `setsid`/`nohup` bila perlu dijalankan di background.
