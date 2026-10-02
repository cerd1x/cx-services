import { Logger, LogLevel, streamLog } from "./shared/infra/logger";
import {
  betaReportEmailer,
  betaReportStore,
  isBetaReportAdmin,
} from "./shared/infra/beta-report";
import type {
  BetaReportFile,
  BetaReportMeta,
  BetaReportPayload,
} from "./shared/infra/beta-report";
import { appConfigs, corsOrigins } from "./app.config";

const l = streamLog(Logger.fromConfig(appConfigs.logger)).child("ApiServer");

let _app: any = null;

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

function resolveBetaReportKey(
  id: string | undefined,
  items: BetaReportMeta[],
): string | null {
  if (!id) return null;
  if (id.includes("/")) return id;
  return items.find((m) => m.id === id)?.key ?? null;
}

async function getApp() {
  if (_app) return _app;
  const { Elysia } = await import("elysia");
  const { cors } = await import("@elysiajs/cors");
  const { gqlYogaAsPluginElysia } =
    await import("./shared/infra/graphql/yoga-server");
  const { rateLimit } = await import("elysia-rate-limit");
  _app = new Elysia({
    /**
     * Cloudflare Workers melarang `new Function`, sedangkan AOT Elysia (TypeBox)
     * memakai `new Function` untuk meng-compile route. `aot: false` memindahkan
     * kompilasi ke runtime tanpa eval.
     */
    aot: false,
    cookie: {
      secrets: appConfigs.app.secretKey,
      expires: new Date(appConfigs.cookie.sessionMaxAge),
      httpOnly: appConfigs.cookie.httpOnly,
      maxAge: appConfigs.cookie.sessionMaxAge,
      secure: appConfigs.cookie.secure,
      sameSite: appConfigs.cookie.sameSite,
    },
  })
    .use((ctx: any) => {
      ctx.onRequest(({ request: { url, method } }: any) => {
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
        errorResponse: new Response(
          JSON.stringify({ error: "Too many requests" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
        // Di development (bukan production), nonaktifkan rate-limit
        // untuk menghindari warning "failed to determine client address"
        // ketika request datang dari local server tanpa header address.
        skip: (ctx: any) => {
          if (appConfigs.isProduction) return false;
          // Nonaktifkan di dev
          return true;
        },
      }),
    )
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
      const key = resolveBetaReportKey(
        params?.id,
        await betaReportStore.list(),
      );
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
    .use(gqlYogaAsPluginElysia({ logging: true }));
  return _app;
}

const handler = {
  async fetch(request: Request) {
    const app = await getApp();
    return app.handle(request);
  },
  async handle(request: Request) {
    return this.fetch(request);
  },
};

export default handler;
export { l };
export { getApp };
