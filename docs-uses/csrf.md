# `CsrfToken`

**File:** `services/shared/kernel/csrf.ts`

Utility untuk generate dan verify CSRF token menggunakan HMAC-SHA256. Digunakan untuk melindungi endpoint mutation dari serangan Cross-Site Request Forgery.

## Flow

```text
generate()
   │
   ├── crypto.getRandomValues(32 bytes)  ← random seed
   │
   ├── CsrfToken.sign(randBytes)         ← HMAC-SHA256(randBytes, secretKey)
   │        │
   │        ├── importKey(secretKey)
   │        └── crypto.subtle.sign("HMAC", cryptoKey, randBytes)
   │
   └── return { token, randHex }
              │         │
              │         └── hex string dari randBytes (disimpan di cache untuk verifikasi)
              └── hex string dari HMAC signature (dikirim ke client)
```

## `sign(randBytes)`

````ts
static async sign(randBytes: Uint8Array): Promise<string>
```text

Menghasilkan HMAC-SHA256 signature dari `randBytes` menggunakan `appConfigs.app.secretKey` sebagai signing key.

**Parameter:**

| Parameter   | Type         | Keterangan                      |
| ----------- | ------------ | ------------------------------- |
| `randBytes` | `Uint8Array` | Random bytes (biasanya 32 byte) |

**Returns:** Hex string dari HMAC signature (64 karakter).

## `generate()`

```ts
static async generate(): Promise<{ token: string; randHex: string }>
````

Menghasilkan CSRF token baru dengan random bytes 32 byte.

**Returns:**

| Field     | Type     | Keterangan                                    |
| --------- | -------- | --------------------------------------------- |
| `token`   | `string` | Hex string HMAC signature — dikirim ke client |
| `randHex` | `string` | Hex string random bytes — disimpan di server  |

## Penggunaan

### Generate Token (Server)

````ts
import { CsrfToken } from "$services/shared/kernel/csrf";

const { token, randHex } = await CsrfToken.generate();

// Simpan randHex di cache, kirim token ke client
await csrfCache.set(token, { userId: user.id, randHex });
return { csrfToken: token };
```text

### Verifikasi Token (Server)

```ts
const stored = csrfCache.get(token);

if (!stored) throw new NotFoundError("CSRF token invalid or expired");

// Re-compute HMAC dari randBytes yang tersimpan
const randBytes = Uint8Array.from(stored.randHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
const recomputed = await CsrfToken.sign(randBytes);

if (recomputed !== token) {
  throw new NotFoundError("CSRF token verification failed");
}

// Hapus setelah dipakai (one-time use)
csrfCache.delete(token);
````

## Keamanan

| Aspek               | Implementasi                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Signing key**     | `appConfigs.app.secretKey` — rahasia, tidak pernah dikirim                         |
| **Algoritma**       | HMAC-SHA256 — tampilan byte-length: 64 hex characters                              |
| **Random seed**     | 32 byte dari `crypto.getRandomValues()` (CSPRNG)                                   |
| **One-time use**    | Token dihapus dari cache setelah verifikasi berhasil                               |
| **Re-verification** | Server re-compute HMAC dari `randBytes` + `secretKey` untuk memastikan token valid |

## Catatan

- Token berlaku selama TTL cache aktif (default 5 menit).
- `randHex` disimpan di server — client hanya menerima `token`.
- Verifikasi tidak membandingkan langsung, tapi re-compute HMAC untuk memastikan token benar-benar di-generate oleh server.

## Cara Kerja Verifikasi CSRF Token

### Alur Generate (awal)

```text
1. generate() → randBytes (32 byte random)
2. CsrfToken.sign(randBytes) → token (HMAC signature)
3. randHex = hex(randBytes)
4. Simpan di cache: key=token, value={userId, randHex}
5. Kirim token ke client (cookie/form/header)
```

### Alur Verifikasi (saat client kirim request)

```text
Client kirim token (dari cookie/form/header)
        │
        ▼
┌─ 1. Cari di cache ─────────────────────────────┐
│   stored = csrfCache.get(token)                 │
│   if (!stored) → throw "token invalid/expired"  │
└────────────────────────────────────────────────┘
        │ found
        ▼
┌─ 2. Decode randHex → randBytes ─────────────────┐
│   stored.randHex = "a3f1b2c4..."               │
│   → Uint8Array.from(hex pairs)                  │
│   → [0xa3, 0xf1, 0xb2, 0xc4, ...]             │
└────────────────────────────────────────────────┘
        │
        ▼
┌─ 3. Re-compute HMAC ────────────────────────────┐
│   CsrfToken.sign(randBytes)                     │
│   = HMAC-SHA256(randBytes, secretKey)           │
│   → recomputed token                            │
└────────────────────────────────────────────────┘
        │
        ▼
┌─ 4. Bandingkan ─────────────────────────────────┐
│   recomputed === token?                         │
│   ✅ match → lanjut, hapus dari cache           │
│   ❌ !match → throw "verification failed"       │
└────────────────────────────────────────────────┘
```

### Kenapa Re-compute?

Token client = `HMAC(randBytes, secretKey)`. Server tidak simpan token di cache — yang disimpan adalah `randHex` (raw random bytes). Saat verifikasi:

1. Ambil `randHex` dari cache → decode jadi `randBytes`
2. Re-compute `HMAC(randBytes, secretKey)`
3. Bandingkan dengan token client

Kalau match, berarti:

- Token benar-benar di-generate oleh server (karena punya `secretKey`)
- `randBytes` yang tersimpan cocok dengan token

### Kenapa Tidak Langsung Compare?

```text
Cache: token → {userId, randHex}
Client: token
```

Kalau langsung `cache.has(token)` — siapapun bisa brute-force token jika tahuan pattern-nya. Dengan re-compute, server membuktikan token itu valid tanpa menyimpan token-nya langsung. Ini also prevents token reuse dari cache leak.

### One-Time Use

Setelah verifikasi berhasil, `csrfCache.delete(token)` — token tidak bisa dipakai lagi.
