import type { Loggable } from "$services/shared/infra/decorators/logger-decorator";
import {
  Logger,
  LogLevel,
  streamLog,
} from "$services/shared/infra/logger";

export const httpStream = streamLog(
  Logger.create(LogLevel.Info, ".logger/http-graphql-log.log"),
).child("HTTP");

export type YogaFetch = (
  request: Request,
  extra?: Record<string, unknown>,
) => Response | Promise<Response>;

export function logYogaFetch(fetchFn: YogaFetch): YogaFetch {
  return (request, extra) => {
    const start = Date.now();
    const log = httpStream.child(request.method);
    log.info("enter:", request.url);

    try {
      const res = fetchFn(request, extra);

      if (res instanceof Promise) {
        return res.then((r) => {
          log.success(`result ${r.status} (${Date.now() - start}ms)`);
          return r;
        });
      }

      log.success(`result ${res.status} (${Date.now() - start}ms)`);
      return res;
    } catch (err) {
      log.error("error:", err);
      throw err;
    }
  };
}

type ResolverFn = (...args: unknown[]) => unknown;

function wrapResolver(
  log: Loggable,
  field: string,
  fn: ResolverFn,
): ResolverFn {
  return async function (this: unknown, ...args: unknown[]) {
    const step = log.child?.(field) ?? log;
    const label = step === log ? `[${field}]` : "";
    step.info(`${label}params:`, (args[1] as object) ?? {});
    const start = Date.now();

    try {
      const result = await fn.apply(this, args);
      step.success(`${label}result (${Date.now() - start}ms):`, result);
      return result;
    } catch (err) {
      step.error(`${label}error (${Date.now() - start}ms):`, err);
      throw err;
    }
  };
}

export function withResolverLogging<T extends Record<string, unknown>>(
  log: Loggable,
  resolvers: T,
): T {
  const result = { ...resolvers } as Record<string, Record<string, unknown>>;

  for (const typeName of ["Query", "Mutation", "Subscription"] as const) {
    const type = resolvers[typeName];
    if (!type || typeof type !== "object") continue;

    const fieldMap = type as Record<string, unknown>;
    const wrapped: Record<string, unknown> = {};
    for (const [field, fn] of Object.entries(fieldMap)) {
      if (typeof fn === "function") {
        wrapped[field] = wrapResolver(log.child?.(typeName) ?? log, field, fn as ResolverFn);
      } else {
        wrapped[field] = fn;
      }
    }
    result[typeName] = wrapped;
  }

  return result as T;
}