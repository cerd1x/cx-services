---
name: oxlint
description: Panduan penggunaan oxlint sebagai linter di project ini, termasuk konfigurasi, cara menjalankan, dan aturan yang diaktifkan.
---

## Cara Menggunakan

### Jalankan oxlint langsung

```bash
bun x oxlint
```

### Jalankan dengan fix

```bash
bun x oxlint --fix
```

### Jalankan pada file/direktori spesifik

```bash
bun x oxlint src/lib/server/auth.ts
```

### Lewati `vp check` (Vite+)

`vp check` sudah termasuk oxlint di dalamnya. Jika hanya ingin linter tanpa type-check/format:

```bash
bun x oxlint
```

## Konfigurasi

Konfigurasi berada di `.oxlintrc.json`:

- **Plugins**: `unicorn`, `typescript`, `oxc`, `eslint`
- **Type-aware**: `true` (menggunakan TypeScript info untuk aturan yang butuh type)
- **Type-check**: `true`
- **Ignore patterns**: `node_modules`, `.svelte-kit`, `build`, `.vercel`, `.wrangler`, `src/routes/demo`

## Aturan Penting

### Allow (`"off"`)

Aturan berikut dimatikan (default oxlint nyalakan):

- `unicorn/filename-case` — project tidak mengikuti konvensi kebab-case di semua file

### Deny (`"error"`)

- `no-undef` — cegah penggunaan variable yang tidak didefinisikan
- `no-console` — peringatan untuk `console.log` yang terlewat

> Jika menemukan false positive, tambahkan override di `.oxlintrc.json`.

## Integrasi Editor

Project sudah dikonfigurasi untuk Zed (`settings.json`). Untuk VS Code, install [oxlint extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxlint-vscode).
