## Auth Module — WebAuthn Passkey Sign-In (Design Doc)

### Tujuan

Menyediakan autentikasi **passkey** (WebAuthn) sehingga PWA bisa login dengan
**biometrik** (fingerprint / Face ID) atau kunci perangkat (Platform
Authenticator). Alur dibangun di atas **Hexagonal Architecture** yang sama dengan
modul auth existing:

- **Domain** — `webauthn.vo.ts` (challenge signing helper)
- **Application** — `PasskeyService` (wrapper `@simplewebauthn/server`) +
  method baru di `AuthService` (`signInWithPassKey`, dll)
- **Ports (out)** — `PasskeyRepository` (abstract)
- **Adapters (driven)** — `PasskeyRepositoryImpl` (Drizzle D1)
- **Adapters (driving)** — GraphQL SDL + resolvers di auth module

---

### Prasyarat Teknis

- **Library**: `@simplewebauthn/server` (server) + `@simplewebauthn/browser`
  (client). Keduanya ES-module murni WebCrypto → aman di Cloudflare Workers
  (sudah diverifikasi tidak ada `node:`/`Buffer`/`process` import).
- **Secure context**: WebAuthn hanya jalan di `https://` atau `http://localhost`.
  Di Pages production (`cxapp-n68.pages.dev`) sudah HTTPS.
- **RP ID / Origin**:
  - `rpID` = `hostname` dari request (contoh: `cxapp-n68.pages.dev`).
  - `expectedOrigin` = header `Origin` dari request (atau `Referer`), fallback
    ke `appConfigs.app.origin`.
  - Di dev lokal (`pages:dev` → `localhost:8788`) rpID `localhost` valid di Chrome.

---

### Storage Challenge (Stateless)

Challenge WebAuthn **tidak disimpan di DB**. Challenge di-*bundle* ke dalam
signed token (HMAC-SHA256 dengan `appConfigs.app.secretKey`, sama seperti
`CsrfToken`) dengan payload:

```ts
services/domain/auth/
├── app/
│   └── auth_service.ts           # Application service (orchestrasi use case)
├── core/
│   ├── model/
│   │   └── auth.model.ts         # Model bisnis (data + behavior)
│   ├── usecase/
│   │   └── *.usecase.ts              # Use-case bisnis
│   ├── value-objects/
│   │   └── logger.ts                 # Logger khusus module
│   └── ports/out/
│       └── auth-repository.port.ts   # Abstract port (repository contract)
├── adapters/
│   ├── driving/
│   │   └── graphql/
│   │       ├── auth.gql          # SDL GraphQL
│   │       └── auth.resolver.ts  # Resolvers GraphQL
│   └── driven/
│       └── drizzle/
│           ├── auth.entity.ts    # Zod schema + Entity class (inti domain)
│           └── auth.repository.ts    # Implementasi repository
└── auth.composition.ts           # Composition root: Service.getInstance(new RepoImpl())
```

`services/shared/infra/db/drizzle-schema/passkey.schema.ts` — tabel D1.
`services/shared/infra/db/drizzle-schema/relations.ts` — relasi user↔passkey.

---

### Port Repository — `core/ports/out/passkey-repository.port.ts`

- **`PasskeyRecord` type** — Record passkey: `id`, `userId`, `credentialId`, `publicKey`, `counter`, `transports`, `deviceName`, `createdAt`
- **Abstract class `PasskeyRepository`** — Port (out) yang mendefinisikan kontrak repository credential WebAuthn. PasskeyService hanya bergantung pada abstraksi ini; implementasi nyata ada di `adapters/driven/drizzle/passkey.repository.ts`. Semua method bersifat `abstract` (wajib diimplementasi adapter).

  **Daftar Method:**

  1. **`save(data)`** — Insert credential passkey baru
     - Parameter:
       - `data: { userId, credentialId, publicKey, counter, transports, deviceName }` — data registrasi dari client
     - Return: `Promise<PasskeyRecord>` — record lengkap yang tersimpan

  2. **`findById(credentialId)`** — Cari passkey by credential ID
     - Parameter:
       - `credentialId: string` — ID credential dari authenticator
     - Return: `Promise<PasskeyRecord | null>` — `null` jika tidak ditemukan

  3. **`findByUserId(userId)`** — Ambil semua passkey milik user
     - Parameter:
       - `userId: number`
     - Return: `Promise<PasskeyRecord[]>` — selalu array (kosong `[]` jika belum ada passkey)

  4. **`updateCounter(credentialId, counter)`** — Update signature counter setelah autentikasi sukses
     - Parameter:
       - `credentialId: string`
       - `counter: number` — nilai counter terbaru dari authenticator
     - Return: `Promise<void>` — tidak mengembalikan apa pun

  5. **`deleteByCredentialId(userId, credentialId)`** — Hapus passkey by credential ID + pemilik
     - Parameter:
       - `userId: number` — guard akses (hanya pemilik yang boleh hapus)
       - `credentialId: string`
     - Return: `Promise<boolean>` — `true` jika ada baris terhapus, `false` jika tidak ditemukan

---

### Dependency Flow

```
Resolver (driving)
   └─ AuthService (application)
        ├─ PasskeyService (application) ── @simplewebauthn/server
        │     └─ PasskeyRepository (port out)
        │           └─ PasskeyRepositoryImpl (driven, Drizzle/D1)
        ├─ UserService
        └─ AuthRepository
```

---

### Keamanan

- `userVerification: "required"` di kedua arah → memaksa biometrik/PIN.
- `expectedOrigin` / `expectedRPID` selalu diverifikasi.
- `counter` di-update setelah setiap autentikasi → deteksi replay.
- Challenge ditandatangani HMAC dengan `secretKey` + expiry 5 menit + binding
  `kind` & `userId` (register).
- `@authorized` pada register/list/delete → hanya user login yang bisa
  mengelola passkey-nya sendiri.
