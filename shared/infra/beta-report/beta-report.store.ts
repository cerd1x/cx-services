import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";
import type { R2Bucket } from "@cloudflare/workers-types";

const l = streamLog(Logger.create(LogLevel.Info)).child("BetaReportStore");

export interface BetaReportLog {
  level?: string;
  tag?: string;
  message?: string;
  timestamp?: string;
}

export interface BetaReportPayload {
  message?: string;
  appVersion?: string;
  platform?: string;
  logs?: BetaReportLog[];
}

export interface BetaReportDoc extends BetaReportPayload {
  id: string;
  createdAt: string;
}

export interface BetaReportMeta {
  id: string;
  key: string;
  filename: string;
  size: number;
  createdAt: string;
}

export interface BetaReportFile {
  key: string;
  doc: BetaReportDoc | null;
  body: string;
}

export interface BetaReportBackend {
  readonly name: string;
  save(key: string, body: string): Promise<void>;
  list(): Promise<BetaReportMeta[]>;
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

export class MemoryBetaReportBackend implements BetaReportBackend {
  readonly name = "memory";
  #files = new Map<string, string>();

  async save(key: string, body: string): Promise<void> {
    this.#files.set(key, body);
  }

  async list(): Promise<BetaReportMeta[]> {
    const items: BetaReportMeta[] = [];
    for (const [key, body] of this.#files) {
      const match = key.match(/([0-9]{17})-([0-9a-f-]{36})\.json$/);
      items.push({
        key,
        id: match?.[2] ?? key,
        filename: key.split("/").pop() ?? key,
        size: body.length,
        createdAt: parseKeyTimestamp(key) ?? new Date().toISOString(),
      });
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(key: string): Promise<string | null> {
    return this.#files.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    this.#files.delete(key);
  }
}

export class R2BetaReportBackend implements BetaReportBackend {
  readonly name = "r2";

  constructor(private readonly bucket: R2Bucket) {}

  async save(key: string, body: string): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType: "application/json" },
    });
  }

  async list(): Promise<BetaReportMeta[]> {
    const objs = await this.bucket.list({ prefix: "beta-reports/" });
    const items: BetaReportMeta[] = [];
    for (const o of objs.objects) {
      const match = o.key.match(/([0-9]{17})-([0-9a-f-]{36})\.json$/);
      items.push({
        key: o.key,
        id: match?.[2] ?? o.key,
        filename: o.key.split("/").pop() ?? o.key,
        size: o.size,
        createdAt: new Date(o.uploaded).toISOString(),
      });
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(key: string): Promise<string | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return obj.text();
  }

  async remove(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}

export function parseKeyTimestamp(key: string): string | null {
  const match = key.match(/(\d{4})\/(\d{2})\/(\d{2})\/(\d{17})/);
  if (!match) return null;
  const [, y, m, d, ts] = match;
  return `${y}-${m}-${d}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}.${ts.slice(14, 17)}Z`;
}

export class BetaReportStore {
  static #instance: BetaReportStore | null = null;

  static getInstance(): BetaReportStore {
    return (this.#instance ??= new BetaReportStore());
  }

  static resetInstance(): void {
    this.#instance = null;
  }

  #backend: BetaReportBackend = new MemoryBetaReportBackend();
  #lastCreatedAt: string | null = null;

  configure(backend?: BetaReportBackend | null): void {
    if (backend) this.#backend = backend;
    l.info(`[BetaReportStore] backend=${this.#backend.name}`);
  }

  get backendName(): string {
    return this.#backend.name;
  }

  async save(payload: BetaReportPayload): Promise<BetaReportMeta> {
    let createdAt = new Date().toISOString();
    if (this.#lastCreatedAt && createdAt <= this.#lastCreatedAt) {
      createdAt = new Date(new Date(this.#lastCreatedAt).getTime() + 1).toISOString();
    }
    this.#lastCreatedAt = createdAt;
    const id = crypto.randomUUID();
    const doc: BetaReportDoc = { id, createdAt, ...payload };
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const ts = createdAt.replace(/[^0-9]/g, "").slice(0, 17);
    const key = `beta-reports/${y}/${m}/${d}/${ts}-${id}.json`;
    const body = JSON.stringify(doc, null, 2);
    await this.#backend.save(key, body);
    l.info(`[BetaReportStore] saved ${key} (${body.length} bytes)`);
    return { id, key, filename: `${ts}-${id}.json`, size: body.length, createdAt };
  }

  async list(): Promise<BetaReportMeta[]> {
    return this.#backend.list();
  }

  async get(key: string): Promise<BetaReportFile | null> {
    const body = await this.#backend.get(key);
    if (body == null) return null;
    let doc: BetaReportDoc | null = null;
    try {
      doc = JSON.parse(body) as BetaReportDoc;
    } catch {
      doc = null;
    }
    return { key, doc, body };
  }

  async remove(key: string): Promise<void> {
    await this.#backend.remove(key);
  }

  renderText(file: BetaReportFile): string {
    const doc = file.doc;
    const lines: string[] = [];
    lines.push(`Beta Report ${doc?.id ?? file.key}`);
    lines.push(`Created At: ${doc?.createdAt ?? "unknown"}`);
    lines.push(`Platform: ${doc?.platform ?? "-"}`);
    lines.push(`App Version: ${doc?.appVersion ?? "-"}`);
    lines.push(`Message: ${doc?.message ?? "-"}`);
    lines.push("");
    const logs = doc?.logs ?? [];
    lines.push(`Logs (${logs.length}):`);
    for (const log of logs.slice(-200)) {
      const tag = log.tag ? `/${log.tag}` : "";
      lines.push(
        `[${log.level ?? "INF"}${tag}] ${log.message ?? JSON.stringify(log)}` +
          (log.timestamp ? ` (${log.timestamp})` : ""),
      );
    }
    return lines.join("\n");
  }
}
