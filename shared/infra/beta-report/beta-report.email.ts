import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";
import type { SendEmail } from "@cloudflare/workers-types";
import type { BetaReportFile } from "$services/shared/infra/beta-report/beta-report.store";

const l = streamLog(Logger.create(LogLevel.Info)).child("BetaReportEmailer");

export interface BetaReportEmailConfig {
  fromEmail?: string;
  fromName?: string;
  to?: string[];
}

export interface BetaReportEmailResult {
  sent: boolean;
  messageId?: string;
  reason?: string;
}

export interface BetaReportEmailRequest {
  report: BetaReportFile;
  subject?: string;
  recipients?: string[];
}

export class BetaReportEmailer {
  static #instance: BetaReportEmailer | null = null;

  static getInstance(): BetaReportEmailer {
    return (this.#instance ??= new BetaReportEmailer());
  }

  static resetInstance(): void {
    this.#instance = null;
  }

  #email: SendEmail | null = null;
  #config: BetaReportEmailConfig = {};

  configure(email?: SendEmail | null, config?: BetaReportEmailConfig): void {
    this.#email = email ?? null;
    this.#config = { ...this.#config, ...(config ?? {}) };
    l.info(`[BetaReportEmailer] email=${this.#email ? "bound" : "none"} to=${(this.#config.to ?? []).join(",")}`);
  }

  get enabled(): boolean {
    return !!this.#email && (this.#config.to?.length ?? 0) > 0;
  }

  async send(req: BetaReportEmailRequest): Promise<BetaReportEmailResult> {
    if (!this.#email) return { sent: false, reason: "EMAIL binding not configured" };
    const recipients = req.recipients ?? this.#config.to;
    if (!recipients || recipients.length === 0) {
      return { sent: false, reason: "No recipient configured" };
    }
    const doc = req.report.doc;
    const id = doc?.id ?? req.report.key;
    const subject = req.subject ?? `[Beta Report] ${id}`;
    const text = req.report.body;
    try {
      const result = await this.#email.send({
        to: recipients,
        from: {
          email: this.#config.fromEmail ?? "noreply@cxapp.pages.dev",
          name: this.#config.fromName ?? "Cerdix Beta",
        },
        subject,
        text,
        attachments: [
          {
            disposition: "attachment",
            filename: `beta-report-${id}.json`,
            type: "application/json",
            content: req.report.body,
          },
        ],
      });
      l.info(`[BetaReportEmailer] sent ${id} to ${recipients.join(",")} (${result.messageId})`);
      return { sent: true, messageId: result.messageId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      l.error(`[BetaReportEmailer] send failed: ${reason}`);
      return { sent: false, reason };
    }
  }
}
