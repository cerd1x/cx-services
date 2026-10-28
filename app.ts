import { Logger, streamLog } from "./shared/infra/logger";
import { Elysia, status, type Context } from "elysia";
import { cors } from "@elysia/cors";
import { rateLimit } from "elysia-rate-limit";
import { openapi } from "@elysiajs/openapi";
import { betaReportEmailer, betaReportStore, isBetaReportAdmin } from "./shared/infra/beta-report";
import type { BetaReportFile, BetaReportMeta, BetaReportPayload } from "./shared/infra/beta-report";
import { appConfigs, corsOrigins } from "./app.config";
import { apiKillswitchService } from "./composition/root.container";
import { gqlYogaAsPluginElysia } from "./shared/infra/graphql/yoga-server";
import { WebStandardAdapter } from "elysia/adapter/web-standard";
const l = streamLog(Logger.fromConfig(appConfigs.logger)).child("ApiServer");

/**
 * Cloudflare Workers melarang pembuatan objek I/O (`Response`) di global scope,
 * jadi rate-limit memakai `Error` sebagai `errorResponse` lalu dipetakan ke
 * response 429 lewat `.onError()`. Bentuk body JSON dipertahankan seperti semula.
 *
 * Catatan: `elysia-rate-limit` dipin di 4.6.3 + patch lokal
 * (`patches/elysia-rate-limit@4.6.3.patch`) karena versi ini masih memakai
 * `{ as: scope }` yang deprecated di Elysia 2 rc. Patch menggantinya dengan
 * argumen posisi `onBeforeHandle(scope, fn)` / `onError(scope, fn)`. Versi 5.x
 * belum bisa dipakai: ia memanggil `beforeHandle`/`error` yang belum ada di
 * Elysia 2.0.0-rc.0.
 */
class RateLimitExceededError extends Error {
  override name = "RateLimitExceededError";
}

async function receiveBetaReport({ body, set }: Context) {
  const payload = (body ?? {}) as BetaReportPayload;
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const meta = await betaReportStore.save(payload);
  l.warn(
    `[BetaReport] ${payload.platform ?? "-"} v${payload.appVersion ?? "?"} · ${logs.length} logs · ${payload.message ?? "(no message)"} · stored=${meta.key}`,
  );
  for (const log of logs.slice(-200)) {
    const tag = log.tag ? `/${log.tag}` : "";
    const line = `[BetaReport${tag}] ${log.message ?? JSON.stringify(log)}`;
    switch ((log.level ?? "INF").toUpperCase()) {
      case "ERR":
        l.error(line);
        break;
      case "WRN":
        l.warn(line);
        break;
      case "DBG":
        l.debug(line);
        break;
      default:
        l.info(line);
    }
  }
  set.status = 201;
  return {
    status: "received",
    id: meta.id,
    stored: true,
    backend: betaReportStore.backendName,
    received: logs.length,
  };
}

function isBetaReportAdminRequest(request: Request): boolean {
  return isBetaReportAdmin(request, appConfigs.betaReport.adminToken);
}

/**
 * Gate untuk endpoint kill switch.
 *
 * Sengaja `isBetaReportAdmin` dipakai ulang supaya tidak ada dua mekanisme
 * token yang bisa berbeda sifat. Operasional: `KILLSWITCH_ADMIN_TOKEN` di-set,
 * kalau tidak token kosong membuat semua request ditolak (fail-closed) —
 * penting, karena endpoint ini bisa mematikan API produksi.
 */
function isKillswitchAdminRequest(request: Request): boolean {
  const token = appConfigs.killswitch.adminToken;
  if (!token) return false;
  return request.headers.get("x-admin-token") === token;
}

function resolveBetaReportKey(id: string | undefined, items: BetaReportMeta[]): string | null {
  if (!id) return null;
  if (id.includes("/")) return id;
  return items.find((m) => m.id === id)?.key ?? null;
}

function getApp() {
  return app;
}

function createApp() {
  return new Elysia({
    // Elysia 2 tidak lagi menyediakan `CloudflareAdapter` (itu API Elysia 1.x).
    // Padanan resminya untuk Workers adalah WebStandardAdapter; AOT dengan
    // `target: "workerd"` juga mengunci adapter ini saat build.
    adapter: WebStandardAdapter,
    cookie: {
      secrets: appConfigs.app.secretKey,
      expires: new Date(appConfigs.cookie.sessionMaxAge),
      httpOnly: appConfigs.cookie.httpOnly,
      maxAge: appConfigs.cookie.sessionMaxAge,
      secure: appConfigs.cookie.secure,
      sameSite: appConfigs.cookie.sameSite,
    },
  })
    .use(
      openapi({
        path: "/openapi",
        documentation: {
          info: {
            title: "CX Services API",
            version: "1.0.0",
            description:
              "CX Services API - REST endpoints + GraphQL at /graphql. Use GraphQL introspection or GraphiQL for full schema exploration.",
            contact: {
              name: "CX Services",
            },
          },
          tags: [
            { name: "Health", description: "Health check endpoints" },
            { name: "BetaReport", description: "Beta report ingestion and management" },
            { name: "Admin", description: "Administrative endpoints" },
            { name: "GraphQL", description: "GraphQL API endpoint" },
          ],
        },
      }),
    )
    .use((ctx) => {
      ctx.onRequest(({ request: { url, method } }) => {
        let _url = new URL(url);
        l.info(`${method} - ${_url.pathname}`);
      });
      return ctx;
    })
    .use(
      cors({
        origin: corsOrigins.length > 0 ? corsOrigins : false,
        credentials: corsOrigins.length > 0,
      }),
    )
    .use(
      rateLimit({
        max: 60,
        duration: 60_000,
        // `Response` tidak boleh dibuat di global scope (Workers), jadi pakai Error.
        errorResponse: new RateLimitExceededError("Too many requests"),
        // Di Workers `server.requestIP()` tidak tersedia, sehingga generator
        // bawaan mengembalikan key kosong dan semua client berbagi satu bucket.
        // Pakai header Cloudflare agar limit dihitung per IP.
        generator: (request) =>
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "anonymous",
        // Di development (bukan production), nonaktifkan rate-limit
        // untuk menghindari warning "failed to determine client address"
        // ketika request datang dari local server tanpa header address.
        skip: () => {
          if (appConfigs.isProduction) return false;
          // Nonaktifkan di dev
          return true;
        },
      }),
    )
    .onError("global", RateLimitExceededError, () => status(429, { error: "Too many requests" }))
    .get(
      "/",
      () => {
        return "🦊 Cerdix API Server Running";
      },
      {
        detail: {
          tags: ["Health"],
          summary: "Root endpoint",
          description: "Basic service status check",
        },
      },
    )
    .get(
      "/health",
      () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      }),
      {
        detail: {
          tags: ["Health"],
          summary: "Health check",
          description: "Service health status",
        },
      },
    )
    .post("/beta/report", receiveBetaReport, {
      detail: {
        tags: ["BetaReport"],
        summary: "Submit beta report",
        description: "Submit beta report with logs",
      },
    })
    .post("/api/beta/report", receiveBetaReport, {
      detail: {
        tags: ["BetaReport"],
        summary: "Submit beta report (API path)",
        description: "Submit beta report with logs",
      },
    })
    .get(
      "/beta/report/list",
      async ({ request, set }: Context) => {
        if (!isBetaReportAdminRequest(request)) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const items = await betaReportStore.list();
        return { status: "ok", items };
      },
      {
        detail: {
          tags: ["BetaReport"],
          summary: "List beta reports",
          description: "List all beta reports (admin only)",
        },
      },
    )
    .get(
      "/beta/report/:id",
      async ({ params, request, set }: Context) => {
        if (!isBetaReportAdminRequest(request)) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const key = resolveBetaReportKey(params?.id, await betaReportStore.list());
        if (!key) {
          set.status = 404;
          return { error: "Not found" };
        }
        const file = await betaReportStore.get(key);
        if (!file) {
          set.status = 404;
          return { error: "Not found" };
        }
        return new Response(file.body, {
          headers: {
            "content-type": "application/json",
            "content-disposition": `attachment; filename="beta-report-${params?.id}.json"`,
          },
        });
      },
      {
        detail: {
          tags: ["BetaReport"],
          summary: "Get beta report",
          description: "Download a beta report by ID (admin only)",
        },
      },
    )
    .post(
      "/beta/report/email",
      async ({ request, body, set }: Context) => {
        if (!isBetaReportAdminRequest(request)) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const { id, ids, subject, to } = (body ?? {}) as {
          id?: string;
          ids?: string[];
          subject?: string;
          to?: string[];
        };
        const targets = ids && ids.length > 0 ? ids : id ? [id] : [];
        const items = await betaReportStore.list();
        const files: BetaReportFile[] = [];
        for (const target of targets) {
          const key = resolveBetaReportKey(target, items);
          if (!key) continue;
          const file = await betaReportStore.get(key);
          if (file) files.push(file);
        }
        if (files.length === 0) {
          set.status = 404;
          return { error: "No report found", found: 0 };
        }
        const result = await betaReportEmailer.send({
          report: files[0],
          subject,
          recipients: to,
        });
        if (!result.sent) {
          set.status = 500;
          return { status: "error", reason: result.reason };
        }
        return {
          status: "sent",
          count: files.length,
          messageId: result.messageId,
        };
      },
      {
        detail: {
          tags: ["BetaReport"],
          summary: "Email beta report",
          description: "Send beta report via email (admin only)",
        },
      },
    )
    .get(
      "/admin/killswitch",
      async ({ request, set }: Context) => {
        if (!isKillswitchAdminRequest(request)) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const items = await apiKillswitchService.listDisabledOperations();
        return {
          status: "ok",
          count: items.length,
          items: items.map((i) => ({
            operation: i.operation,
            reason: i.reason ?? null,
            disabledAt: i.disabledAt,
          })),
        };
      },
      {
        detail: {
          tags: ["Admin"],
          summary: "List disabled GraphQL operations",
          description: "List all operations currently disabled by kill switch (admin only)",
        },
      },
    )
    .post(
      "/admin/killswitch/:operation",
      async ({ params, request, body, set }: Context) => {
        if (!isKillswitchAdminRequest(request)) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const { reason } = (body ?? {}) as { reason?: string };
        const entry = await apiKillswitchService.disableOperation(params?.operation, reason);
        return {
          status: "disabled",
          operation: entry.operation,
          reason: entry.reason ?? null,
          disabledAt: entry.disabledAt,
        };
      },
      {
        detail: {
          tags: ["Admin"],
          summary: "Disable GraphQL operation",
          description: "Disable a specific GraphQL operation (admin only)",
        },
      },
    )
    .delete(
      "/admin/killswitch/:operation",
      async ({ params, request, set }: Context) => {
        if (!isKillswitchAdminRequest(request)) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const result = await apiKillswitchService.enableOperation(params?.operation);
        return { status: "enabled", ...result };
      },
      {
        detail: {
          tags: ["Admin"],
          summary: "Enable GraphQL operation",
          description: "Re-enable a previously disabled GraphQL operation (admin only)",
        },
      },
    )
    .use(gqlYogaAsPluginElysia({ logging: true }))
    .compile();
}

const app = createApp();

const handler = {
  async fetch(request: Request) {
    return app.handle(request);
  },
  async handle(request: Request) {
    return this.fetch(request);
  },
};

export default handler;
export { l };
export { getApp };
export { app };
