# Security Issues Audit Report

**Date**: 2026-11-05
**Auditor**: Automated Security Scan
**Severity**: 🔴 Critical (5) | 🟡 Medium (8) | 🔵 Low (3)

---

## 🔴 Critical Severity

### 1. Weak Password Hashing Algorithm

**Location**: `shared/kernel/password-utils.ts:68-73`

**Issue**: New passwords hashed with PBKDF2, not Argon2id. Legacy code can *verify* Argon2id hashes but never *generates* them.

```ts
static async hash(password: string): Promise<string> {
  assertPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS); // ← Weak
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bufToHex(salt)}$${bufToHex(derived)}`;
}
```

**Risk**: PBKDF2-SHA256 vulnerable to GPU attacks. Argon2id memory-hard, resistant to ASIC/GPU cracking.

**Impact**: Password database easily cracked if leaked.

**Fix**: 
```ts
static async hash(password: string): Promise<string> {
  assertPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await argon2idAsync(password, salt, {
    t: 3,      // iterations
    m: 65536,  // memory (64 MB)
    p: 1,      // parallelism
    dkLen: 32, // derived key length
    version: 0x13,
  });
  return `$argon2id$v=19$t=3,m=65536,p=1$${btoa(String.fromCharCode(...salt))}$${btoa(String.fromCharCode(...derived))}`;
}
```

---

### 2. Timing Attack on Admin Token Comparison

**Location**: `app.ts:85-89`

**Issue**: Admin token validated with `===` operator, vulnerable to timing attacks.

```ts
function isKillswitchAdminRequest(request: Request): boolean {
  const token = appConfigs.killswitch.adminToken;
  if (!token) return false;
  return request.headers.get("x-admin-token") === token; // ← Timing leak
}
```

**Risk**: Attacker measures response time to guess token character-by-character. 100k requests = full token extraction.

**Impact**: Full admin access to kill switch, can disable all API operations.

**Fix**:
```ts
import { constantTimeEqual } from "$services/shared/kernel/password-utils";

function isKillswitchAdminRequest(request: Request): boolean {
  const token = appConfigs.killswitch.adminToken;
  if (!token) return false;
  const provided = request.headers.get("x-admin-token") ?? "";
  if (provided.length !== token.length) return false;
  return constantTimeEqual(
    new TextEncoder().encode(provided),
    new TextEncoder().encode(token)
  );
}
```

---

### 3. Missing CSRF Token Verification

**Location**: `shared/kernel/csrf.ts`

**Issue**: `CsrfToken` class only generates tokens, no verification function exists.

```ts
export class CsrfToken {
  static async sign(randBytes: Uint8Array): Promise<string> { ... }
  static async generate(): Promise<{ token: string; randHex: string }> { ... }
  // ← No verify() method
}
```

**Risk**: CSRF tokens created but never validated. Form submissions accept any token or no token.

**Impact**: Cross-site request forgery attacks on all mutations.

**Fix**:
```ts
static async verify(token: string, randHex: string): Promise<boolean> {
  const randBytes = hexToBuf(randHex);
  const expected = await CsrfToken.sign(randBytes);
  return constantTimeEqual(
    new TextEncoder().encode(token),
    new TextEncoder().encode(expected)
  );
}
```

---

### 4. Unvalidated JSON Parsing

**Location**: Multiple files

**Affected Files**:
- `domain/auth/adapters/driving/graphql/auth.resolver.ts:16-18`
- `domain/auth/core/usecase/passkey_generate_registration_options.usecase.ts:15-18`
- `domain/auth/core/usecase/passkey_verify_authentication.usecase.ts:15-18`
- `domain/contacts/adapters/driven/drizzle/contact.repository.ts:15-18`

**Issue**: `JSON.parse()` followed by unsafe type cast without schema validation.

```ts
function parseJsonObject<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T; // ← Assumes structure, no validation
  } catch {
    return {} as T;
  }
}
```

**Risk**: Malformed/malicious JSON passes through. Empty object fallback hides errors.

**Impact**: 
- Unexpected runtime errors
- Type confusion attacks
- Silent data corruption

**Fix**:
```ts
import { z } from "zod";

function parseJsonObject<T>(raw: string, schema: z.ZodSchema<T>): T {
  const parsed = JSON.parse(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(`Invalid JSON structure: ${result.error.message}`);
  }
  return result.data;
}
```

---

### 5. Empty Secret Fallbacks

**Location**: `app.config.ts`

**Issue**: Critical secrets default to empty string instead of throwing errors.

```ts
secretKey: env.SECRET_KEY ?? "",           // JWT signing key
adminToken: env.KILLSWITCH_ADMIN_TOKEN ?? "", // Admin access
apiToken: env.CLOUDFLARE_API_TOKEN ?? "",  // Cloudflare API
encryptionKey: env.GEMINI_OAUTH_ENCRYPTION_KEY ?? "", // OAuth encryption
```

**Risk**: 
- Empty `secretKey` = predictable JWT tokens
- Empty `adminToken` = kill switch disabled (fail-closed, but still logged)
- Empty `encryptionKey` = OAuth tokens unencrypted

**Impact**: Authentication bypass, admin access, API credential exposure.

**Fix**:
```ts
function requireEnv(key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

secretKey: requireEnv("SECRET_KEY"),
adminToken: requireEnv("KILLSWITCH_ADMIN_TOKEN"),
```

---

## 🟡 Medium Severity

### 6. Missing Rate Limiting

**Location**: All auth endpoints, password operations

**Issue**: No rate limiting on:
- Login attempts
- Password hashing (computationally expensive)
- Token generation
- WebAuthn challenges

**Risk**: 
- Brute force password attacks
- DoS via expensive operations (Argon2id/PBKDF2 burn CPU)
- Token enumeration

**Impact**: Account takeover, service unavailability.

**Fix**: Add rate limiter middleware (e.g., Cloudflare Rate Limiting, or in-memory sliding window).

---

### 7. GraphQL Introspection Exposure

**Location**: `app.config.ts:46-51`

**Issue**: GraphiQL + introspection can be enabled in production.

```ts
/**
 * GraphiQL IDE + introspection query aktif?
 * Default: development saja. Set "true" untuk mengaktifkan juga di
 * production (mis. untuk debugging lewat browser). Perhatian:
 * introspection=on berarti seluruh schema bisa dibaca publik —
 */
```

**Risk**: Full schema visible to attackers. Reveals:
- All types/fields
- Mutation names
- Input structures
- Potential attack surface

**Impact**: Easier to craft targeted attacks.

**Recommendation**: Never enable in production. Add startup warning if `GQL_GRAPHIQL=true` in non-dev.

---

### 8. Missing Input Size Limits

**Location**: All GraphQL resolvers, file uploads

**Issue**: No maximum size checks on:
- String fields (names, descriptions)
- Array inputs
- File uploads
- Query depth/complexity

**Risk**: 
- Memory exhaustion
- Query complexity attacks
- Large payload DoS

**Impact**: Service crash, resource exhaustion.

**Fix**:
```ts
// In yoga-server.ts
import { createYoga } from 'graphql-yoga';

const yoga = createYoga({
  // ... existing config
  limit: {
    json: 1024 * 1024,  // 1 MB
    form: 10 * 1024 * 1024, // 10 MB
  },
});
```

---

### 9. Authorization Exclude List Bypass

**Location**: `shared/infra/graphql/directives.ts:55`

**Issue**: `exclude` array bypasses authentication for listed operations.

```ts
export function authorizedDirectiveTransformer(
  schema: GraphQLSchema,
  opts?: { exclude?: string[] },
): GraphQLSchema {
  const exclude = opts?.exclude ?? [];
  // ...
  if (exclude.includes(rootOperationName(info.path))) {
    return originalResolve(source, args, context, info); // ← No auth check
  }
```

**Risk**: Misconfigured exclude list = protected ops run unauthenticated.

**Action**: Audit which operations are excluded and document why.

**Fix**: Add logging when excluded operation accessed:
```ts
if (exclude.includes(rootOperationName(info.path))) {
  console.warn(`[AUTH] Excluded operation accessed: ${rootOperationName(info.path)}`);
  return originalResolve(source, args, context, info);
}
```

---

### 10. Kill Switch Fail-Open Design

**Location**: `shared/infra/graphql/directives.ts:138-163`

**Issue**: If kill switch service unavailable, operations proceed (fail-open by design).

```ts
/**
 * **Fail-open by design.** Bila service tidak terpasang di context, atau
 * pembacaan switch melempar (D1 down, tabel belum termigrasi), operation tetap
 * dijalankan dan error dicatat. Kill switch tidak boleh bisa menjatuhkan
 * seluruh API — itu akan jadi outage sendiri.
 */
try {
  const state = await service.isOperationDisabled(operation);
  // ...
} catch (error) {
  if (error instanceof ApiDisabledError) throw error;
  console.warn(`[killswitch] check failed for ${operation}, allowing:`, error);
}

return originalResolve(source, args, context, info); // ← Proceeds on error
```

**Risk**: During outage, cannot disable broken/malicious operations.

**Trade-off**: Intentional design choice (prevent kill switch itself from causing outage).

**Recommendation**: Document explicitly in ops runbook. Consider admin override mechanism.

---

### 11. WebAuthn Challenge Replay Prevention

**Location**: `domain/auth/core/value-objects/webauthn.vo.ts:59`

**Issue**: Need verification of:
- Challenge uniqueness (prevent replay)
- Origin validation
- rpId matching
- Token binding

```ts
static async verify(encoded: string, expectedChallenge: string): Promise<unknown> {
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
  } catch {
    // ...
  }
  // ← Missing: challenge comparison, origin check, replay prevention
}
```

**Risk**: Replay attacks if challenges not tracked/invalidated.

**Action**: Audit WebAuthn implementation against [MDN guidelines](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API).

---

### 12. Missing Security Headers

**Location**: `app.ts` (Elysia server setup)

**Issue**: No security headers configured:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Referrer-Policy`

**Risk**: 
- Clickjacking (missing X-Frame-Options)
- XSS (missing CSP)
- MITM (missing HSTS)

**Fix**:
```ts
app.use(({ set }) => {
  set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  set.headers['X-Content-Type-Options'] = 'nosniff';
  set.headers['X-Frame-Options'] = 'DENY';
  set.headers['Content-Security-Policy'] = "default-src 'self'";
  set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
});
```

---

### 13. Admin Role from Database (Good Practice, Document)

**Location**: `shared/infra/graphql/directives.ts:92-93`

**Note**: This is actually **secure**, but worth documenting:

```ts
/**
 * Sumber kebenaran adalah `context.userAuth.role`, yang diambil dari database
 * saat token diverifikasi di `createContext` — bukan dari klaim di dalam JWT.
 * Jadi mencabut akses admin berlaku segera, tanpa menunggu token kedaluwarsa.
 */
```

**Why secure**: Admin role checked against DB, not JWT claim. Revocation immediate.

---

## 🔵 Low Severity

### 14. Logging Sensitive Operations

**Issue**: `@logMethod` decorator logs all method calls including potentially sensitive data.

**Risk**: Passwords, tokens logged if passed to decorated methods.

**Recommendation**: 
- Exclude sensitive parameters from logs
- Use `[REDACTED]` for password/token fields
- Ensure log files have restricted permissions

---

### 15. Database Password in Config

**Location**: `app.config.ts:36-39`

```ts
db: {
  url: env.DATABASE_URL ?? "local.db",
  password: env.DATABASE_PASSWORD ?? "",
}
```

**Issue**: Fallback to empty password for DB connection.

**Risk**: Connection to misconfigured DB instance without auth.

**Fix**: Throw if `DATABASE_PASSWORD` missing in production.

---

### 16. No Certificate Pinning

**Issue**: No TLS certificate pinning for external API calls.

**Risk**: MITM on API calls (Cloudflare, OAuth providers).

**Mitigation**: Cloudflare Workers handles TLS, but verify external API calls use HTTPS.

---

## Summary

| Severity | Count | Top Issues |
|----------|-------|------------|
| 🔴 Critical | 5 | Weak password hash, timing attacks, empty secrets |
| 🟡 Medium | 8 | Rate limiting, introspection, input limits |
| 🔵 Low | 3 | Logging, DB password, cert pinning |

## Immediate Action Items

1. **Switch to Argon2id** for password hashing (1 line change in `password-utils.ts`)
2. **Use timing-safe comparison** for admin tokens (use existing `constantTimeEqual`)
3. **Add CSRF verification** function
4. **Throw on empty secrets** at startup (fail-fast)
5. **Add rate limiting** to auth endpoints
6. **Configure security headers** in Elysia middleware

## Remediation Priority

1. Week 1: Fix critical #1, #2, #5 (hashing, timing, secrets)
2. Week 2: Fix critical #3, #4 + medium #6 (CSRF, JSON validation, rate limiting)
3. Week 3: Fix medium #7, #8, #12 (introspection, limits, headers)
4. Ongoing: Audit exclude list, WebAuthn implementation

---

**Last Updated**: 2026-11-05
