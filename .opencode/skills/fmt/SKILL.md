---
name: fmt
description: Panduan formatting project ini dengan formatter bawaan Bun (bun fmt), termasuk konfigurasi di bunfig.toml dan opsi printWidth.
---

# Format — `bun fmt`

Project ini memakai **formatter bawaan Bun** (tidak lagi memakai `oxfmt`).
Konfigurasi berada di `bunfig.toml`, section `[fmt]`.

## Cara Menjalankan

```bash
bun run fmt                   # format seluruh project (script: bun fmt)
bun fmt --check               # cek tanpa menulis
bun fmt src "tests/**/*.ts"   # format file/glob tertentu
```

Format dari stdin:

```bash
bun fmt --stdin-filepath=file.ts < input.ts
```

## Konfigurasi (`bunfig.toml`)

```toml
[fmt]
printWidth = 100
ignorePatterns = ["coverage"]
svelte = false
sortTailwindcss = true
```

- `printWidth = 100` — mempertahankan lebar baris formatting sebelumnya.
- Bun otomatis mengabaikan `node_modules/`, file minified, dan lockfile.

## Catatan

- Bun juga membaca `.prettierrc`/`.oxfmtrc.json` bila ada; project ini memakai
  `bunfig.toml` sebagai sumber tunggal.
- Output `bun fmt` setara Prettier.
