---
name: lint
description: Panduan linting project ini dengan linter bawaan Bun (bun lint), termasuk konfigurasi di bunfig.toml dan aturan yang dinonaktifkan.
---

# Lint — `bun lint`

Project ini memakai **linter bawaan Bun** (tidak lagi memakai `oxlint`).
Konfigurasi berada di `bunfig.toml`, section `[lint]`.

## Cara Menjalankan

```bash
bun run lint        # lint seluruh project (script: bun lint)
bun run lint:fix    # auto-fix (bun lint --fix)
bun lint --doctor   # lihat konfigurasi & jumlah rule yang aktif
```

Lint file/glob tertentu:

```bash
bun lint app.ts "shared/**/*.ts"
```

## Konfigurasi (`bunfig.toml`)

```toml
[lint]
ignorePatterns = ["node_modules/", "build/", ".wrangler/", "drizzle/", ".idea/"]

[lint.rules]
"@typescript-eslint/await-thenable" = "off"
"@typescript-eslint/no-explicit-any" = "off"
"@typescript-eslint/no-unsafe-function-type" = "off"
"@typescript-eslint/no-empty-object-type" = "off"
"prefer-const" = "off"
```

- Bun otomatis mengabaikan `node_modules/` dan semua entri `.gitignore`.
- Rule di atas dimatikan agar hasil lint setara dengan konfigurasi lama (`oxlint`).

## Catatan

- Bun juga membaca konfigurasi ESLint/oxlint bila ada; project ini memakai
  `bunfig.toml` sebagai sumber tunggal.
- Untuk rule yang butuh type info, aktifkan `typeAware = true` di `[lint]`.
