import { Logger, streamLog } from "./shared/infra/logger";
import { Elysia, status } from "elysia";
import { cors } from "@elysia/cors";
import { rateLimit } from "elysia-rate-limit";
import { betaReportEmailer, betaReportStore, isBetaReportAdmin } from "./shared/infra/beta-report";
import type { BetaReportFile, BetaReportMeta, BetaReportPayload } from "./shared/infra/beta-report";
import { appConfigs, corsOrigins } from "./app.config";
import { apiKillswitchService } from "./composition/root.container";
import { gqlYogaAsPluginElysia } from "./shared/infra/graphql/yoga-server";

const l = streamLog(Logger.fromConfig(appConfigs.logger)).child("ApiServer");

/**
 * Cloudflare Workers melarang pembuatan objek I/O (`Response`) di global scope,
 * jadi rate-limit memakai `Error` sebagai `errorResponse` lalu dipetakan ke
 * response 429 lewat `.error()`. Bentuk body JSON dipertahankan seperti semula.
 */
class RateLimitExceededError extends Error {
  override name = "RateLimitExceededError";
}

async function receiveBetaReport({ body, set }: any) {
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
      ctx.request(({ request: { url, method } }: any) => {
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
    .error(RateLimitExceededError, () => status(429, { error: "Too many requests" }))
    .get("/", () => {
      return "🦊 Cerdix API Server Running";
    })
    .get("/health", () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }))
    .post("/beta/report", receiveBetaReport)
    .post("/api/beta/report", receiveBetaReport)
    .get("/beta/report/list", async ({ request, set }: any) => {
      if (!isBetaReportAdminRequest(request)) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const items = await betaReportStore.list();
      return { status: "ok", items };
    })
    .get("/beta/report/:id", async ({ params, request, set }: any) => {
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
    })
    .post("/beta/report/email", async ({ request, body, set }: any) => {
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
    })
    .get("/admin/killswitch", async ({ request, set }: any) => {
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
    })
    .post("/admin/killswitch/:operation", async ({ params, request, body, set }: any) => {
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
    })
    .delete("/admin/killswitch/:operation", async ({ params, request, set }: any) => {
      if (!isKillswitchAdminRequest(request)) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const result = await apiKillswitchService.enableOperation(params?.operation);
      return { status: "enabled", ...result };
    })
    .use(gqlYogaAsPluginElysia({ logging: true }));
}

const app: any = createApp();

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
