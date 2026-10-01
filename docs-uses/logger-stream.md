# Stream Logger

**File:** `shared/infra/logger/stream.ts`

Logger berantai (namespaced stream) yang bisa **diteruskan** ke method/sink selanjutnya. Setiap log punya namespace bertingkat (`A → B → C`), bisa di-`pipe` ke konsol/file/consumer lain, dan aman terhadap data sensitif (password, token, JWT) via `sanitizeLogValue`. Sink bawaan (`treeSink`) merender seluruh rantai panggilan sebagai **satu rentetan bertingkat** (indentasi): `enter:`/`params:` membuka level, `success/result/error` menutupnya — jadi HTTP → resolver → service → sub-service tampil sebagai satu alur pohon, bukan baris-baris terpisah.

```text
logger.child("signIn")            → namespace [AuthService → signIn]
.log("params", {...})             → tiap method logging chainable (return this)
.child("validate").success(...)   → turunkan namespace lebih dalam
.pipe(sink)                       → teruskan tiap entry ke sink/method berikutnya
```

---

## Konsep

| Piece              | Peran                                            |
| ------------------ | ------------------------------------------------ |
| `StreamLogger`     | Logger utama dengan namespace `path` bertingkat  |
| `LogEntry`         | Satu event log (`level`, `path`, `args`, `timestamp`) |
| `LoggerSink`       | Consumer/forwarder `(entry) => void`             |
| `consoleSink()`    | Sink render flat → ke `Logger` (dengan sanitasi) |
| `treeSink()`       | Sink default → rentetan bertingkat satu pohon (indentasi) |
| `streamLog()`         | Factory: `StreamLogger` + `treeSink`          |

Semua method (*immutable view*):
- `child(name)` → logger baru dengan path `[...path, name]`, sink diwariskan
- `pipe(sink)` → logger baru dengan sink tambahan
- `debug/info/success/warn/error() → this` → chainable, kembali ke logger yang sama

---

## Quick Start

```ts
import { Logger, LogLevel, stream } from "$services/shared/infra/logger";

export const logger = streamLog(
  Logger.create(LogLevel.Info, ".logger/auth-service-log.log"),
).child("AuthService");
```

Pakai di service dengan decorator `@logMethod`:

```ts
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../core/value-objects/logger";

export class AuthService {
  @logMethod(logger)
  async signIn(username: string, password: string) {
    // decorator otomatis menurunkan namespace ke [AuthService → signIn]
    return this.#issueSession(...);
  }
}
```

> Decorator `logMethod` menerima `Loggable` (baik `Logger` maupun `StreamLogger`). Jika logger punya `.child()`, decorator otomatis membungkus namespace per-method.

---

## Logging bertingkat (contoh nyata `signIn`)

```ts
@logMethod(logger)
async signIn(username: string, password: string) {
  const log = logger.child("signIn");

  log.child("params").info({ username, password });

  const user = await this.#userService.userByUsername(username);

  if (!(await PasswordUtils.verify(password, user.password))) {
    log.child("validate").error("fail -> invalid password");
    throw new AuthenticationError("Invalid password");
  }

  log.child("validate").success("success", { id: user.id?.toNumb, name: user.name });

  const result = await this.#issueSession(user);

  log.child("result").success({
    user: { id: result.user.id?.toNumb, name: result.user.name },
    session: result.session,
    refreshToken: result.refreshToken,
  });

  return result;
}
```

Output konsol:

```text
[AuthService → signIn] enter: alice secret123
[AuthService → signIn → params] { username: "alice", password: "***" }
[AuthService → signIn → validate] success { id: 1, name: "E2E" }
[AuthService → signIn → result] { user: {...}, session: "***", refreshToken: "***" }
[AuthService → signIn] success (244ms): {...}
```

---

## Meneruskan log (`pipe`)

`pipe()` meneruskan **setiap** entry log ke method/sink berikutnya — bisa berkali-kali:

```ts
import { StreamLogger } from "$services/shared/infra/logger";

const collected: LogEntry[] = [];
const collector: LoggerSink = (entry) => collected.push(entry);

const log = StreamLogger.from([consoleSink(Logger.create())])
  .child("orders")
  .pipe(collector);          // tambah sink depan/memberi logger baru

log.info("created", { id: 42, total: 100000 });
// konsol  : [orders] created {id: 42, total: 100000}
// cek     : collected[0].path → ["orders"], collected[0].level → "INF"
```

Sink custom — filter level, forward ke external service, metrics, dll:

```ts
const notify: LoggerSink = (entry) => {
  if (entry.level === "ERR") sendAlert(entry.args);
};

streamLog(logger)
  .child("payment")
  .pipe(notify)
  .info("attempting gateway call", { ref: "GW-1" })
  .error("gateway timeout");
```

---

## LogEntry

| Field       | Type                                   | Keterangan                      |
| ----------- | -------------------------------------- | ------------------------------- |
| `level`     | `"DBG" \| "INF" \| "SUC" \| "WRN" \| "ERR"` | Tingkat log            |
| `path`      | `string[]`                             | Namespace saat ini             |
| `args`      | `unknown[]`                            | Argumen mentah (belum di-sanitize) |
| `timestamp` | `number`                               | `Date.now()`                   |

> Sink terima `args` **mentah**. Sanitasi hanya terjadi di `consoleSink`. Jika sink custom perlu data aman, pakai `sanitizeLogValue(entry.args[i])`.

---

## Sanitasi otomatis

`consoleSink` memanggil `sanitizeLogValue` (dari `logger/sanitize.ts`):

- Key berbahaya di-mask: `password`, `session`, `refreshToken`, `accessToken`, `idToken`, `token`, `authorization`, `apiKey`, `secret` → `"***"`
- String JWT standalone (`eyJ...`) → `<jwt>`
- `ID` instance → `ID #<toNumb>`
- Error → `Name: message`; `Date` → ISO; array → dipetakan
- Object class → ditambah `$type: "ClassName"`, method/prototype tidak ikut
- Circular reference & depth > 4 ditangani (`[Circular]` / `[MaxDepth]`)

Contoh `User` entity yang di-log:

```text
{ $type: "User", id: "ID #9", name: "E2E", password: "***", avatarUrl: null }
```

---

## Integrasi layanan lain

### GraphQL resolver (framework-agnostic wrapper)

`shared/infra/graphql/graphql-stream.ts` membungkus resolver:

```ts
withResolverLogging(gqlStream.child("Auth"), authResolvers);
```

Hasil: `[GraphQL → Auth → Mutation → signIn] params: {...} → result/error`.

### HTTP layer

```ts
logYogaFetch(yoga); // [HTTP → POST] enter: {url} → result {status} ({ms})
```

### Chain penuh request

```text
[HTTP → POST] enter: http://localhost/graphql
[GraphQL → Auth → Mutation → signIn] params: {...}
[AuthService → signIn] enter: ...
[AuthService → signIn → params] ...
[AuthService → signIn → result] ...
[AuthService → signIn] success (244ms)
[GraphQL → Auth → Mutation → signIn] result (249ms)
[HTTP → POST] result 200 (263ms)
```

---

## API reference

| API                        | Keterangan                                            |
| -------------------------- | ----------------------------------------------------- |
| `streamLog(logger)`           | Buat StreamLogger + `treeSink(logger)`               |
| `StreamLogger.from(sinks)` | Buat StreamLogger kosong dengan daftar sink           |
| `.child(name)`             | Turunkan namespace (immutable)                        |
| `.pipe(sink)`              | Forward entry ke sink tambahan (immutable)            |
| `.path`                    | Path namespace sebagai string (`A → B`)               |
| `.info/.success/.warn/.error/.debug(...args)` | Log & return `this` (chainable) |
| `treeSink(logger)`        | Sink rentetan bertingkat: `enter:`/`params:` buka level, `success/result/error` tutup (indentasi) |
| `consoleSink(logger)`      | Sink flat ke `Logger` (sanitasi + file log)                |
| `LoggerSink`               | `(entry: LogEntry) => void`                           |