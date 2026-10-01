/// <reference types="@cloudflare/workers-types" />
import type { D1Database, R2Bucket, SendEmail } from "@cloudflare/workers-types";
import { appConfigs } from "./app.config";
import { configureBetaReport } from "$services/shared/infra/beta-report";
import { useD1 } from "$services/shared/infra/db";
import handler from "./app";

/**
 * Entry point Cloudflare Worker (`wrangler dev` / `wrangler deploy`).
 *
 * Tanggung jawabnya hanya *wiring binding* (D1, R2, Email) lalu meneruskan
 * request ke Elysia app di `app.ts`. Semua logika bisnis tetap di `domain/`.
 *
 * Dibundel terpisah lewat `bun run build` (lihat `scripts/build.ts`) karena
 * SDL di-import sebagai `*.gql?raw` yang tidak didukung esbuild/wrangler.
 */
export interface Env {
  CX_DB: D1Database;
  BETA_REPORT_R2?: R2Bucket;
  EMAIL?: SendEmail;
}

let bootstrap: Promise<void> | null = null;

function bindRuntime(env: Env): Promise<void> {
  bootstrap ??= (async () => {
    await useD1(env.CX_DB);
    configureBetaReport({
      r2: env.BETA_REPORT_R2 ?? null,
      email: env.EMAIL ?? null,
      emailConfig: {
        fromEmail: appConfigs.betaReport.fromEmail,
        fromName: appConfigs.betaReport.fromName,
        to: appConfigs.betaReport.toEmails,
      },
    });
  })();
  return bootstrap;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await bindRuntime(env);
    return handler.fetch(request);
  },
};
