import { sanitizeLogValue } from "$services/shared/infra/logger/sanitize";

export type Loggable = {
  child?(name: string): Loggable;
  info(...args: unknown[]): unknown;
  success(...args: unknown[]): unknown;
  warn(...args: unknown[]): unknown;
  error(...args: unknown[]): unknown;
};

function withLogging<T extends (...args: unknown[]) => unknown>(
  logger: Loggable,
  original: T,
  methodName: string,
): T {
  const childLogger = logger.child?.(methodName);
  const log = childLogger ?? logger;
  const label = childLogger ? "" : `[${methodName}]`;
  const format = (args: unknown[]) => args.map((a) => sanitizeLogValue(a)) as unknown[];

  return function (this: unknown, ...args: unknown[]) {
    log.info(`${label}enter:`, ...format(args));
    const start = Date.now();
    try {
      const result = original.apply(this, args);
      if (result instanceof Promise) {
        return result.then(
          (val: unknown) => {
            log.success(`${label}success (${Date.now() - start}ms):`, sanitizeLogValue(val));
            return val;
          },
          (err: unknown) => {
            log.error(`${label}error (${Date.now() - start}ms):`, sanitizeLogValue(err));
            throw err;
          },
        );
      }
      log.success(`${label}success (${Date.now() - start}ms):`, sanitizeLogValue(result));
      return result;
    } catch (err) {
      log.error(`${label}error:`, sanitizeLogValue(err));
      throw err;
    }
  } as T;
}

export function logMethod<T extends (...args: unknown[]) => unknown>(logger: Loggable) {
  return function (
    targetOrOriginal: object | T,
    propertyKeyOrContext: string | ClassMethodDecoratorContext,
    descriptor?: PropertyDescriptor,
  ): any {
    if (descriptor) {
      return legacyDescriptorDecorator(
        logger,
        targetOrOriginal as object,
        propertyKeyOrContext as string,
        descriptor,
      );
    } else {
      return stage3Decorator(
        logger,
        targetOrOriginal as T,
        propertyKeyOrContext as ClassMethodDecoratorContext,
      );
    }
  };
}

function legacyDescriptorDecorator(
  logger: Loggable,
  _target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  descriptor.value = withLogging(logger, descriptor.value, propertyKey);
  return descriptor;
}

function stage3Decorator<T extends (...args: unknown[]) => unknown>(
  logger: Loggable,
  original: T,
  context: ClassMethodDecoratorContext,
): T {
  return withLogging(logger, original, String(context.name));
}

export function wrapServiceMethods<T extends object>(
  instance: T,
  logger: Loggable,
  methods: { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never }[keyof T][],
): void {
  for (const key of methods) {
    const original = instance[key] as (...args: never[]) => unknown;
    if (typeof original !== "function") continue;
    (instance as Record<string, unknown>)[key as string] = logMethod(logger)(original, {
      name: String(key),
    } as ClassMethodDecoratorContext) as (...args: unknown[]) => unknown;
  }
}