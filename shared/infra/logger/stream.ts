import type { Logger } from "$services/shared/infra/logger";
import { sanitizeLogValue } from "./sanitize";

export type LogLevelName = "DBG" | "INF" | "SUC" | "WRN" | "ERR";

export type LogEntry = {
  level: LogLevelName;
  path: string[];
  args: unknown[];
  timestamp: number;
};

export type LoggerSink = (entry: LogEntry) => void;

export function consoleSink(logger: Logger): LoggerSink {
  return (entry) => {
    const tag = entry.path.length ? `[${entry.path.join(" → ")}]` : "";
    const args = entry.args.map((a) => sanitizeLogValue(a));
    switch (entry.level) {
      case "DBG":
        logger.debug(tag, ...args);
        break;
      case "SUC":
        logger.success(tag, ...args);
        break;
      case "WRN":
        logger.warn(tag, ...args);
        break;
      case "ERR":
        logger.error(tag, ...args);
        break;
      default:
        logger.info(tag, ...args);
    }
  };
}

let treeIndent = 0;

const OPEN_RE = /^(enter|params):/;
const CLOSE_RE = /^(success|result|error)/;

function isSpanOpen(args: unknown[]): boolean {
  return typeof args[0] === "string" && OPEN_RE.test(args[0]);
}

function isSpanClose(args: unknown[]): boolean {
  return typeof args[0] === "string" && CLOSE_RE.test(args[0]);
}

/**
 * Sink yang merender semua entry menjadi satu rentetan log bertingkat: tiap
 * `enter:`/`params:` membuka level, tiap `success/result/error` menutupnya,
 * sehingga rantai panggilan (HTTP → resolver → service → sub-service) tampil
 * sebagai satu alur pohon, bukan baris-baris terpisah.
 */
export function treeSink(logger: Logger): LoggerSink {
  return (entry) => {
    const tag = entry.path.length ? `[${entry.path.join(" → ")}]` : "";
    const args = entry.args.map((a) => sanitizeLogValue(a));

    if (isSpanClose(args) && treeIndent > 0) treeIndent--;

    const indent = "  ".repeat(treeIndent);
    const prefix = `${indent}${tag}`;

    switch (entry.level) {
      case "DBG":
        logger.debug(prefix, ...args);
        break;
      case "SUC":
        logger.success(prefix, ...args);
        break;
      case "WRN":
        logger.warn(prefix, ...args);
        break;
      case "ERR":
        logger.error(prefix, ...args);
        break;
      default:
        logger.info(prefix, ...args);
    }

    if (isSpanOpen(args)) treeIndent++;
  };
}

export class StreamLogger {
  readonly #path: string[];
  readonly #sinks: LoggerSink[];

  constructor(path: string[] = [], sinks: LoggerSink[] = []) {
    this.#path = path;
    this.#sinks = sinks;
  }

  static from(sinks: LoggerSink[] = []): StreamLogger {
    return new StreamLogger([], sinks);
  }

  /** Path namespace saat ini, contoh: `UserService` atau `UserService → createUser`. */
  get path(): string {
    return this.#path.join(" → ");
  }

  /** Turunkan logger baru dengan namespace lanjutan (sink ikut diwariskan). */
  child(name: string): StreamLogger {
    return new StreamLogger([...this.#path, name], [...this.#sinks]);
  }

  /** Teruskan setiap entry log ke sink/method berikutnya. Returns logger baru (immutable). */
  pipe(sink: LoggerSink): StreamLogger {
    return new StreamLogger(this.#path, [...this.#sinks, sink]);
  }

  #emit(level: LogLevelName, args: unknown[]): this {
    const entry: LogEntry = { level, path: this.#path, args, timestamp: Date.now() };
    for (const sink of this.#sinks) sink(entry);
    return this;
  }

  debug(...args: unknown[]): this {
    return this.#emit("DBG", args);
  }

  info(...args: unknown[]): this {
    return this.#emit("INF", args);
  }

  success(...args: unknown[]): this {
    return this.#emit("SUC", args);
  }

  warn(...args: unknown[]): this {
    return this.#emit("WRN", args);
  }

  error(...args: unknown[]): this {
    return this.#emit("ERR", args);
  }
}

export function streamLog(logger: Logger): StreamLogger {
  return new StreamLogger([], [treeSink(logger)]);
}