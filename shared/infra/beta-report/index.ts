import { BetaReportStore, MemoryBetaReportBackend, R2BetaReportBackend } from "$services/shared/infra/beta-report/beta-report.store";
import { BetaReportEmailer, type BetaReportEmailConfig } from "$services/shared/infra/beta-report/beta-report.email";
import type { R2Bucket, SendEmail } from "@cloudflare/workers-types";

export * from "$services/shared/infra/beta-report/beta-report.store";
export * from "$services/shared/infra/beta-report/beta-report.email";
export type { SendEmail } from "@cloudflare/workers-types";

export const betaReportStore = BetaReportStore.getInstance();
export const betaReportEmailer = BetaReportEmailer.getInstance();

export interface BetaReportRuntimeConfig {
  r2?: R2Bucket | null;
  email?: SendEmail | null;
  emailConfig?: BetaReportEmailConfig;
  adminToken?: string;
}

let runtimeAdminToken: string | null = null;

export function configureBetaReport(runtime: BetaReportRuntimeConfig): void {
  if (runtime.r2) {
    betaReportStore.configure(new R2BetaReportBackend(runtime.r2));
  } else {
    betaReportStore.configure(new MemoryBetaReportBackend());
  }
  betaReportEmailer.configure(runtime.email ?? null, runtime.emailConfig);
  if (runtime.adminToken !== undefined) runtimeAdminToken = runtime.adminToken;
}

export function isBetaReportAdmin(request: Request, defaultToken: string): boolean {
  const token = runtimeAdminToken ?? defaultToken;
  return token.length > 0 && request.headers.get("x-admin-token") === token;
}
