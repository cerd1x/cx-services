---
name: oxfmt
description: Panduan penggunaan oxfmt sebagai formatter di project ini, termasuk konfigurasi, cara menjalankan, dan integrasi editor.
---

## Cara Menggunakan

### Format semua file

```bash
bun x oxfmt
```

Secara default `oxfmt` langsung menulis perubahan (`--write`).

### Check saja (tanpa menulis)

```bash
bun x oxfmt --check
```

### Lihat file yang akan berubah

```bash
bun x oxfmt --list-different
```

### Format file/direktori spesifik

```bash
bun x oxfmt src/lib/server/auth.ts
```

### Format dari stdin

```bash
bun x oxfmt --stdin-filepath=file.ts < input.ts
```

## Konfigurasi

Konfigurasi berada di `.oxfmtrc.json`:

- **svelte**: `true` — support format `.svelte` files
- **experimentalTailwindcss**: `{}` — Tailwind CSS class sorting
- **ignorePatterns**: `["coverage"]`

## Integrasi dengan Vite+

`vp check` sudah termasuk oxfmt. Untuk format-only tanpa linter/type-check:

```bash
bun x oxfmt
```

## Integrasi Editor

Project sudah dikonfigurasi untuk Zed (`settings.json`) — oxfmt sebagai formatter default untuk: CSS, GraphQL, HTML, JavaScript, JSON, JSON5, JSONC, Less, Markdown, MDX, SCSS, TypeScript, TSX, Vue, YAML. Format on save otomatis.

Untuk VS Code, install [oxfmt extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxfmt-vscode).
