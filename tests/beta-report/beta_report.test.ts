import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { BetaReportDoc, BetaReportPayload, SendEmail, BetaReportFile } from "$services/shared/infra/beta-report";

let app: any;
let betaReportStore: any;
let betaReportEmailer: any;

const payload: BetaReportPayload = {
  message: "crash on startup",
  appVersion: "1.2.3",
  platform: "android",
  logs: [
    { level: "ERR", tag: "session", message: "boom", timestamp: "2026-01-01T00:00:00.000Z" },
    { level: "INF", tag: "app", message: "started", timestamp: "2026-01-01T00:00:01.000Z" },
  ],
};

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(async () => {
  const appMod = await import("$services/app");
  app = appMod.default;
  await appMod.getApp();
  const infra = await import("$services/shared/infra/beta-report");
  betaReportStore = infra.betaReportStore;
  betaReportEmailer = infra.betaReportEmailer;
  infra.configureBetaReport({ adminToken: "test-admin-token" });
}, 30_000);

afterAll(() => {
  betaReportStore.configure(null);
  betaReportEmailer.configure(null, {});
});

describe("BetaReportStore", () => {
  it("saves a report as a file with timestamped key", async () => {
    const meta = await betaReportStore.save(payload);
    expect(meta.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(meta.key).toMatch(/^beta-reports\/\d{4}\/\d{2}\/\d{2}\/\d{17}-[0-9a-f-]{36}\.json$/);
    expect(meta.filename).toMatch(/^\d{17}-[0-9a-f-]{36}\.json$/);
    expect(meta.size).toBeGreaterThan(0);
    expect(meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns the stored file with parsed doc", async () => {
    const meta = await betaReportStore.save(payload);
    const file: BetaReportFile = await betaReportStore.get(meta.key);
    expect(file).not.toBeNull();
    expect(file?.doc?.id).toBe(meta.id);
    expect(file?.doc?.message).toBe("crash on startup");
    expect(file?.doc?.logs?.length).toBe(2);
  });

  it("lists reports newest-first", async () => {
    const before = (await betaReportStore.list()).length;
    const first = await betaReportStore.save({ message: "one" });
    const second = await betaReportStore.save({ message: "two" });
    const items = await betaReportStore.list();
    expect(items.length).toBe(before + 2);
    const firstIdx = items.findIndex((m: any) => m.id === first.id);
    const secondIdx = items.findIndex((m: any) => m.id === second.id);
    expect(secondIdx).toBeLessThan(firstIdx);
  });

  it("removes a report", async () => {
    const meta = await betaReportStore.save({ message: "to remove" });
    expect(await betaReportStore.get(meta.key)).not.toBeNull();
    await betaReportStore.remove(meta.key);
    expect(await betaReportStore.get(meta.key)).toBeNull();
  });

  it("renders human-readable text with logs", async () => {
    const meta = await betaReportStore.save(payload);
    const file = await betaReportStore.get(meta.key);
    const text = betaReportStore.renderText(file);
    expect(text).toContain("crash on startup");
    expect(text).toContain("android");
    expect(text).toContain("1.2.3");
    expect(text).toContain("[ERR/session] boom");
    expect(text).toContain("[INF/app] started");
  });
});

describe("BetaReportEmailer", () => {
  it("returns graceful failure when EMAIL binding is missing", async () => {
    betaReportEmailer.configure(null, { to: ["ops@example.com"] });
    const file: BetaReportFile = {
      key: "beta-reports/2026/01/01/20260101000000-abc.json",
      doc: { id: "abc", createdAt: "2026-01-01T00:00:00.000Z", message: "x" },
      body: JSON.stringify({ id: "abc" }),
    };
    const result = await betaReportEmailer.send({ report: file });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("EMAIL binding");
  });

  it("returns graceful failure when no recipient is configured", async () => {
    const emailMock = { send: mock(async () => ({ messageId: "m1" })) };
    betaReportEmailer.configure(emailMock as unknown as SendEmail, { to: [] });
    const file: BetaReportFile = {
      key: "k",
      doc: { id: "abc", createdAt: "x" },
      body: "{}",
    };
    const result = await betaReportEmailer.send({ report: file });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("No recipient");
  });

  it("sends an email with the report attached", async () => {
    const emailMock = {
      send: mock(async (_msg: any) => ({ messageId: "m1" })),
    };
    betaReportEmailer.configure(emailMock as unknown as SendEmail, {
      to: ["ops@example.com"],
      fromEmail: "noreply@test.dev",
      fromName: "Test Beta",
    });
    const file: BetaReportFile = {
      key: "k",
      doc: { id: "abc", createdAt: "x", message: "crash" },
      body: JSON.stringify({ id: "abc", message: "crash" }),
    };
    const result = await betaReportEmailer.send({ report: file, subject: "Custom subject" });
    expect(result.sent).toBe(true);
    expect(result.messageId).toBe("m1");
    const sent = emailMock.send.mock.calls[0][0];
    expect(sent.to).toEqual(["ops@example.com"]);
    expect(sent.from.email).toBe("noreply@test.dev");
    expect(sent.subject).toBe("Custom subject");
    expect(sent.attachments[0].filename).toContain("beta-report-abc.json");
    expect(sent.attachments[0].type).toBe("application/json");
    expect(sent.attachments[0].content).toContain("crash");
  });
});

describe("POST /api/beta/report", () => {
  it("stores the report and returns 201", async () => {
    const res = await post("http://localhost/api/beta/report", payload);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe("received");
    expect(json.stored).toBe(true);
    expect(json.received).toBe(2);
    expect(json.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.backend).toBe("memory");

    const items = await betaReportStore.list();
    const match = items.find((m: any) => m.id === json.id);
    const file = await betaReportStore.get(match?.key);
    expect(file?.doc?.appVersion).toBe("1.2.3");
  });

  it("accepts the non-prefixed path too", async () => {
    const res = await post("http://localhost/beta/report", payload);
    expect(res.status).toBe(201);
    expect((await res.json()).stored).toBe(true);
  });

  it("tolerates an empty body", async () => {
    const res = await post("http://localhost/api/beta/report", {});
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.received).toBe(0);
  });
});

describe("GET /beta/report/list", () => {
  it("requires admin token", async () => {
    const res = await app.fetch(new Request("http://localhost/beta/report/list"));
    expect(res.status).toBe(401);
  });

  it("lists stored reports with admin token", async () => {
    await post("http://localhost/api/beta/report", { message: "listed" });
    const res = await app.fetch(
      new Request("http://localhost/beta/report/list", {
        headers: { "x-admin-token": "test-admin-token" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeGreaterThan(0);
    expect(json.items[0]).toHaveProperty("key");
    expect(json.items[0]).toHaveProperty("id");
  });
});

describe("GET /beta/report/:id", () => {
  it("downloads a stored report as JSON attachment", async () => {
    const created = await post("http://localhost/api/beta/report", payload);
    const { id } = await created.json();
    const res = await app.fetch(
      new Request(`http://localhost/beta/report/${id}`, {
        headers: { "x-admin-token": "test-admin-token" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const doc: BetaReportDoc = await res.json();
    expect(doc.id).toBe(id);
    expect(doc.message).toBe("crash on startup");
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.fetch(
      new Request("http://localhost/beta/report/does-not-exist", {
        headers: { "x-admin-token": "test-admin-token" },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /beta/report/email", () => {
  it("emails a stored report via the EMAIL binding", async () => {
    const created = await post("http://localhost/api/beta/report", payload);
    const { id } = await created.json();
    const emailMock = {
      send: mock(async (_msg: any) => ({ messageId: "route-m1" })),
    };
    betaReportEmailer.configure(emailMock as unknown as SendEmail, {
      to: ["ops@example.com"],
      fromEmail: "noreply@test.dev",
    });
    const res = await post(
      "http://localhost/beta/report/email",
      { id },
      { "x-admin-token": "test-admin-token" },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("sent");
    expect(json.messageId).toBe("route-m1");
    const sent = emailMock.send.mock.calls[0][0];
    expect(sent.attachments[0].filename).toContain(`${id}.json`);
  });

  it("returns 401 without admin token", async () => {
    const res = await post("http://localhost/beta/report/email", { id: "abc" });
    expect(res.status).toBe(401);
  });
});
