import { ID } from "$services/shared/kernel/id";

/**
 * Mode debug: aktif jika `LOG_LEVEL=debug` (atau `CXD_DEBUG=1|true`).
 * Saat aktif, seluruh sistem menampilkan semua level log (termasuk DBG) dan
 * detail error lengkap (stack trace) alih-alih hanya `Name: message`.
 */
const env = typeof process !== "undefined" ? process.env : undefined;
let debugActive =
  /^(debug|1|true)$/i.test(env?.LOG_LEVEL?.trim() ?? "") ||
  /^(1|true)$/i.test(env?.CXD_DEBUG?.trim() ?? "");

export function setLogDebug(enabled: boolean): void {
  debugActive = enabled;
}

export function isLogDebug(): boolean {
  return debugActive;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "session",
  "refreshToken",
  "accessToken",
  "idToken",
  "token",
  "authorization",
  "apiKey",
  "secret",
]);

export function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
  debug = isLogDebug(),
): unknown {
  if (value === null || typeof value !== "object") {
    if (
      typeof value === "string" &&
      /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
    ) {
      return "<jwt>";
    }
    return value;
  }
  if (depth > 4) return "[MaxDepth]";
  if (seen.has(value as object)) return "[Circular]";

  if (ID.is(value)) return `ID #${value.toNumb}`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    // Debug: teruskan Error asli agar console menampilkan stack trace lengkap.
    return debug ? value : `${value.name}: ${value.message}`;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((v) => sanitizeLogValue(v, seen, depth + 1));
  }

  const obj = value as object;
  seen.add(obj);
  const ctor = (obj as { constructor?: { name?: string } }).constructor;
  const typeName = ctor?.name && ctor.name !== "Object" ? ctor.name : undefined;
  const out: Record<string, unknown> = {};
  if (typeName) out.$type = typeName;
  for (const [key, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "***";
    } else if (typeof v === "function") {
      continue;
    } else {
      out[key] = sanitizeLogValue(v, seen, depth + 1);
    }
  }
  seen.delete(obj);
  return out;
}