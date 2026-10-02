/**
 * Konfigurasi runtime `cx-services`.
 *
 * Berdiri sendiri: hanya membaca `process.env` (Cloudflare Workers mengisi
 * `process.env` dari `vars` + `secrets` ketika `nodejs_compat` aktif), tidak
 * bergantung SvelteKit.
 */

const env = process.env;
const isProd = env.NODE_ENV === "production" || env.NODE_ENV === "prod";

function toList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const appConfigs = {
  env: env.NODE_ENV ?? "development",
  isProduction: isProd,
  app: {
    /** Path GraphQL yang dilayani worker ini. */
    api: env.GQL_PATH ?? "/graphql",
    version: "1.0.0",
    secretKey: env.SECRET_KEY ?? "",
    /** Origin web yang diizinkan oleh CORS (dipisah koma). */
    origin: env.ORIGIN ?? "",
    sessionConstant: "__sst__",
  },
  db: {
    url: env.DATABASE_URL ?? "local.db",
    password: env.DATABASE_PASSWORD ?? "",
  },
  graphql: {
    /** Batas kedalaman query GraphQL (field selection set tersarang).
     *  Schema memakai Relay-style pagination, jadi tiap relasi menambah
     *  ~2–3 level. ENV: GQL_MAX_DEPTH
     */
    maxDepth: toInt(env.GQL_MAX_DEPTH, 20),
  },
  logger: {
    /** Logger output mode:
     * - "console" → hanya ke console (default)
     * - "file" → hanya ke file (di dir)
     * - "console|file" atau "file|console" → console DAN file
     * ENV: LOGGER_OUTPUT
     */
    dir: env.LOGGER_DIR ?? ".logger-file",
    output: env.LOGGER_OUTPUT ?? "console",
  },
  cookie: {
    sessionKey: "__sst__",
    refreshKey: "__rft__",
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("strict" as const) : ("lax" as const),
    sessionMaxAge: 60 * 60 * 24 * 30,
    refreshMaxAge: 60 * 60 * 24 * 90,
  },
  cloudflare: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: env.CLOUDFLARE_DATABASE_ID ?? "",
    apiToken: env.CLOUDFLARE_API_TOKEN ?? "",
  },
  betaReport: {
    fromEmail: env.BETA_REPORT_FROM_EMAIL ?? "noreply@cx-services.workers.dev",
    fromName: env.BETA_REPORT_FROM_NAME ?? "Cerdix Beta",
    toEmails: toList(env.BETA_REPORT_TO_EMAILS),
    adminToken: env.BETA_REPORT_ADMIN_TOKEN ?? "",
    r2Bucket: env.BETA_REPORT_R2_BUCKET ?? "cx-services-beta-reports",
  },
  // OAuth Gemini — dipakai klien desktop (cx-dompetqu), tidak dipakai worker.
  geminiOAuth: {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    redirectUri: env.GEMINI_OAUTH_REDIRECT_URI ?? "",
    tokenStore: env.GEMINI_OAUTH_TOKEN_STORE ?? "d1",
    encryptionKey: env.GEMINI_OAUTH_ENCRYPTION_KEY ?? "",
  },
};

/** Daftar origin web untuk CORS. Dipakai `app.ts` dan `server.ts`. */
export const corsOrigins = toList(appConfigs.app.origin);
