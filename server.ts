import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { gqlYogaAsPluginElysia } from "./shared/infra/graphql/yoga-server";
import { Logger, LogLevel, streamLog } from "./shared/infra/logger";
import { appConfigs, corsOrigins } from "./app.config";
import { node } from "@elysiajs/node";
import { rateLimit } from "elysia-rate-limit";
import { useD1 } from "./shared/infra/db";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Entry point Bun/Node (`bun run server.ts`).
 *
 * Butuh binding D1. Karena D1 hanya tersedia di runtime Cloudflare (atau lewat
 * `wrangler dev`), binding dibaca dari `globalThis.CX_DB` yang harus di-set
 * oleh host. Untuk pengembangan lokal sehari-hari pakai `bun run dev`
 * (`wrangler dev`) yang sudah menyediakan D1 + R2 + Email otomatis.
 */
const d1 = (globalThis as { CX_DB?: D1Database }).CX_DB;
if (!d1) {
  console.error(
    "[cx-services] Binding D1 tidak ditemukan. Jalankan `bun run dev` (wrangler dev) " +
      "atau set globalThis.CX_DB sebelum meng-import server.ts.",
  );
  process.exit(1);
}
await useD1(d1);

const l = streamLog(Logger.create(LogLevel.Info, `${appConfigs.logger.dir}/app.log`)).child(
  "ApiServer",
);
/**
 * `ORIGIN` bisa berisi **beberapa domain** dipisah koma.
 * Jika diisi, production akan mengizinkan hanya domain tersebut, bukan `false`.
 */
const corsOrigin = corsOrigins.length > 0 ? corsOrigins : appConfigs.isProduction ? false : true;
const corsCredentials = appConfigs.app.origin ? true : appConfigs.isProduction ? false : true;
const app = new Elysia({
  adapter: node(),
  cookie: {
    secrets: appConfigs.app.secretKey,
    expires: new Date(appConfigs.cookie.sessionMaxAge),
    httpOnly: appConfigs.cookie.httpOnly,
    maxAge: appConfigs.cookie.sessionMaxAge,
    secure: appConfigs.cookie.secure,
    sameSite: appConfigs.cookie.sameSite,
  },
})
  .use((ctx) => {
    ctx.onRequest(({ request: { url, method } }) => {
      let _url = new URL(url);
      l.info(`${method} - ${_url.pathname}`);
    });
    return ctx;
  })
  .use(cors({ origin: corsOrigin, credentials: corsCredentials }))
  .use(
    rateLimit({
      max: 60,
      duration: 60_000,
      errorResponse: new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    }),
  )
  .get("/", () => {
    return "🦊 Cerdix API Server Running";
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(gqlYogaAsPluginElysia({ logging: true }));

app.listen(3001);

l.info(`🦊 API Server running at http://localhost:${app.server?.port}`);
l.info(`📊 GraphQL endpoint: http://localhost:${app.server?.port}/graphql`);

process.on("SIGINT", () => {
  l.info("\n🛑 Shutting down API server...");
  void app.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  l.info("\n🛑 Shutting down API server...");
  void app.stop();
  process.exit(0);
});
