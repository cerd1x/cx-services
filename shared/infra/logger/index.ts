import { isLogDebug } from "./sanitize";

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return Object.getOwnPropertyNames(error).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (error as unknown as Record<string, unknown>)[key];
      return acc;
    }, {});
  }
  return error;
}

export function formatLog(level: string, args: unknown[], name?: string): string {
  const timestamp = new Date().toISOString();
  const namePart = name ? ` [${name}]` : "";
  const message = args
    .map((a) =>
      typeof a === "object"
        ? JSON.stringify(serializeError(a), null, 0)
        : typeof a === "string"
          ? a
          : JSON.stringify(a),
    )
    .join(" ");
  return `[${timestamp}] [${level}]${namePart} ${message}\n`;
}

export class Logger {
  static #instanceLogger: Logger;
  #level: LogLevel = LogLevel.Info;
  #logFile: string | null = null;
  #name: string | null = null;

  static getInstance(level?: LogLevel, logFile?: string, name?: string): Logger {
    if (!Logger.#instanceLogger) {
      Logger.#instanceLogger = new Logger(level, logFile, name);
    } else {
      if (logFile) Logger.#instanceLogger.#logFile = logFile;
      if (name) Logger.#instanceLogger.#name = name;
      Logger.#instanceLogger.#level = level ?? Logger.#instanceLogger.#level;
    }
    if (isLogDebug()) {
      console.info(
        `[Logger] Debug mode: ON — menampilkan semua level log & detail error (stack) di seluruh system`,
      );
    }
    console.log(
      `[Logger] Level: ${Logger.#instanceLogger.#level}, File: ${Logger.#instanceLogger.#logFile}, Name: ${Logger.#instanceLogger.#name}`,
    );
    return Logger.#instanceLogger;
  }

  static create(level?: LogLevel, logFile?: string, name?: string): Logger {
    return new Logger(level, logFile, name);
  }

  /**
   * Buat Logger dari `appConfigs.logger`.
   *
   * `output` mendukung:
   * - `"console"` — hanya ke console
   * - `"file"` — hanya ke file (path di `dir`)
   * - `"console|file"` atau `"file|console"` — ke console DAN ke file
   *
   * Default `"console"`.
   */
  static fromConfig(config: { output?: string; dir?: string }): Logger {
    const output = (config.output ?? "console").toLowerCase();
    const isFile = output.includes("file");
    const isConsole = output.includes("console") || !isFile;
    const logFile = isFile ? `${config.dir ?? ".logger-file"}/app.log` : undefined;
    const logger = new Logger(LogLevel.Info, logFile, undefined);
    return logger;
  }

  private constructor(level?: LogLevel, logFile?: string, name?: string) {
    this.#level = level ?? LogLevel.Info;
    this.#logFile = process.env.NODE_ENV === "production" ? null : (logFile ?? null);
    this.#name = name ?? null;
  }

  setLevel(level: LogLevel) {
    this.#level = level;
  }

  setLogFile(path: string) {
    this.#logFile = path;
  }

  setName(name: string) {
    this.#name = name;
  }

  static #fsLazy: { appendFileSync: Function; existsSync: Function; mkdirSync: Function } | null =
    null;
  static #pathLazy: { dirname: Function } | null = null;
  static #canWriteFile = true;

  async #ensureFs(logFile?: string) {
    if (!Logger.#canWriteFile) return;
    if (Logger.#fsLazy && Logger.#pathLazy) return;
    try {
      const [fsMod, pathMod] = await Promise.all([import("fs"), import("path")]);
      // Cloudflare Workers (nodejs_compat) mengekspos API `fs`, tetapi operasi
      // tulis/mkdir meledak (EPERM). Probe capability terhadap direktori log
      // yang benar-benar dipakai (bukan /tmp, yang selalu writable di workerd).
      // Jika gagal, disable permanen untuk process ini.
      const testDir = logFile ? pathMod.dirname(logFile) : "/tmp";
      const probeDir = testDir && testDir !== "." ? testDir : "/tmp";
      const testFile = pathMod.join(probeDir, "__cf_write_test__");
      try {
        if (!fsMod.existsSync(probeDir)) fsMod.mkdirSync(probeDir, { recursive: true });
        fsMod.writeFileSync(testFile, "test");
        fsMod.unlinkSync(testFile);
      } catch {
        Logger.#canWriteFile = false;
        return;
      }
      Logger.#fsLazy = {
        appendFileSync: fsMod.appendFileSync,
        existsSync: fsMod.existsSync,
        mkdirSync: fsMod.mkdirSync,
      };
      Logger.#pathLazy = { dirname: pathMod.dirname };
    } catch {
      Logger.#canWriteFile = false;
    }
  }

  async #appendToFile(level: string, args: unknown[]) {
    if (!this.#logFile) return;
    if (!Logger.#canWriteFile) return;
    if (process.env.NODE_ENV === "production") return;
    const logLine = formatLog(level, args, this.#name ?? undefined);
    try {
      await this.#ensureFs(this.#logFile ?? undefined);
      if (!Logger.#canWriteFile || !Logger.#fsLazy || !Logger.#pathLazy) return;
      const fs = Logger.#fsLazy;
      const path = Logger.#pathLazy;
      const dir = path.dirname(this.#logFile);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(this.#logFile, logLine, { flag: "a" });
    } catch (e) {
      // Nonaktifkan percobaan berikutnya supaya tidak spam (mis. runtime tanpa FS).
      Logger.#canWriteFile = false;
      console.error("[Logger] File write failed:", serializeError(e));
    }
  }

  static #isTerminal =
    typeof process !== "undefined" && typeof process.stdout?.isTTY === "boolean"
      ? process.stdout.isTTY
      : typeof Bun !== "undefined";

  get #prefix(): string {
    return this.#name ? `[${this.#name}]` : "";
  }

  /**
   * Level efektif: saat debug mode aktif (`LOG_LEVEL=debug`), semua level
   * terangkat ke `Debug` sehingga seluruh system menampilkan semuanya.
   */
  get #gatedLevel(): LogLevel {
    return isLogDebug() ? LogLevel.Debug : this.#level;
  }

  get #ts(): string {
    return new Date().toLocaleTimeString("id-ID", { hour12: false }).replace(".", "-");
  }

  #color(level: string): string {
    if (!Logger.#isTerminal) return level;
    const colors: Record<string, string> = {
      DBG: "\x1b[90m", // gray
      INF: "\x1b[36m", // cyan
      WRN: "\x1b[33m", // yellow
      ERR: "\x1b[31m", // red
      SUC: "\x1b[32m", // green
    };
    return `${colors[level] ?? ""}${level}\x1b[0m`;
  }

  #icon(level: string): string {
    const icons: Record<string, string> = {
      DBG: "🐛",
      INF: "ℹ",
      WRN: "⚠",
      ERR: "✗",
      SUC: "✓",
    };
    return icons[level] ?? "";
  }

  debug(...args: unknown[]) {
    if (this.#gatedLevel <= LogLevel.Debug) {
      console.debug(
        `[${this.#color("DBG")}] ${this.#icon("DBG")} ${this.#ts} ${this.#prefix}`,
        ...args,
      );

      void this.#appendToFile("DBG", args);
    }
  }

  info(...args: unknown[]) {
    if (this.#gatedLevel <= LogLevel.Info) {
      console.info(
        `[${this.#color("INF")}] ${this.#icon("INF")} ${this.#ts} ${this.#prefix}`,
        ...args,
      );
      void this.#appendToFile("INF", args);
    }
  }

  success(...args: unknown[]) {
    if (this.#gatedLevel <= LogLevel.Info) {
      console.info(
        `[${this.#color("SUC")}] ${this.#icon("SUC")} ${this.#ts} ${this.#prefix}`,
        ...args,
      );
      void this.#appendToFile("INF", args);
    }
  }

  warn(...args: unknown[]) {
    if (this.#gatedLevel <= LogLevel.Warn) {
      console.warn(
        `[${this.#color("WRN")}] ${this.#icon("WRN")} ${this.#ts} ${this.#prefix}`,
        ...args,
      );
      void this.#appendToFile("WRN", args);
    }
  }

  error(...args: unknown[]) {
    if (this.#gatedLevel <= LogLevel.Error) {
      console.error(
        `[${this.#color("ERR")}] ${this.#icon("ERR")} ${this.#ts} ${this.#prefix}`,
        ...args,
      );
      void this.#appendToFile("ERR", args);
    }
  }
}

export const logger = Logger.getInstance();

export { sanitizeLogValue, isLogDebug, setLogDebug } from "./sanitize";
export * from "./stream";
