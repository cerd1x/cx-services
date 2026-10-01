Logger utility singleton untuk logging console + file.

## File: `services/logger/index.ts`

```ts
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export function formatLog(level: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const message = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a, null, 0) : String(a)))
    .join(" ");
  return `[${timestamp}] [${level}] ${message}\n`;
}

export class Logger {
  static #instance: Logger;
  #level: LogLevel = LogLevel.Info;
  #logFile: string | null = null;

  static init(level?: LogLevel, logFile?: string): Logger {
    if (Logger.#instance) return Logger.#instance;
    Logger.#instance = new Logger(level, logFile);
    return Logger.#instance;
  }

  static getInstance(): Logger {
    if (!Logger.#instance) {
      Logger.#instance = new Logger();
    }
    return Logger.#instance;
  }

  private constructor(level?: LogLevel, logFile?: string) {
    this.#level = level ?? LogLevel.Info;
    this.#logFile = logFile ?? null;
  }

  setLevel(level: LogLevel) {
    this.#level = level;
  }
  setLogFile(path: string) {
    this.#logFile = path;
  }

  debug(...args: unknown[]) {
    if (this.#level <= LogLevel.Debug) {
      console.debug(`[DBG]`, ...args);
      this.#appendToFile("DBG", args);
    }
  }

  info(...args: unknown[]) {
    if (this.#level <= LogLevel.Info) {
      console.info(`[INF]`, ...args);
      this.#appendToFile("INF", args);
    }
  }

  warn(...args: unknown[]) {
    if (this.#level <= LogLevel.Warn) {
      console.warn(`[WRN]`, ...args);
      this.#appendToFile("WRN", args);
    }
  }

  error(...args: unknown[]) {
    if (this.#level <= LogLevel.Error) {
      console.error(`[ERR]`, ...args);
      this.#appendToFile("ERR", args);
    }
  }
}

export const logger = Logger.getInstance();
```

## Aturan

| Aturan              | Keterangan                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| **Singleton**       | `static #instance` dengan `init()` / `getInstance()`. Constructor private. |
| **Log Level**       | `Debug=0` (paling rendah) s/d `Error=3` (paling tinggi). Default: `Info`.  |
| **Level filtering** | Method hanya jalan jika `level <= #level`.                                 |
| **Console prefix**  | Output ke console dengan prefix `[DBG]`, `[INF]`, `[WRN]`, `[ERR]`.        |
| **File output**     | Jika `setLogFile(path)` dipanggil, log juga ditulis ke file.               |
| **Bun first**       | Jika runtime Bun, pakai `Bun.write` (append). Jika gagal fallback ke fs.   |
| **Node fallback**   | Fallback ke `fs.appendFileSync`. Buat direktori parent jika belum ada.     |
| **File format**     | `[ISO_TIMESTAMP] [LEVEL] message\n` — JSON untuk object.                   |
| **Env config**      | `LOGGER_DIR` (default `.logger`) — lokasi file log di `api-server.ts`.     |

## Cara Pakai

```ts
import { logger, Logger, LogLevel } from "$services/logger";

// Inisialisasi di entry point
Logger.init(LogLevel.Info, ".logger/app.log");

// Atur level runtime
logger.setLevel(LogLevel.Debug);

// Logging
logger.info("Server started", { port: 3001 });
logger.error("Something failed", err);
```

## Test

```ts
import { Logger, LogLevel, formatLog, logger } from "$services/logger";

// formatLog — pure function, test langsung
formatLog("INF", ["hello"]); // => "[ISO] [INF] hello\n"

// Level filtering — spy console
vi.spyOn(console, "info");
logger.info("msg"); // terpanggil hanya jika level sesuai

// File output — setLogFile + readFileSync
logger.setLogFile("/tmp/test.log");
logger.info("write test");
// verifikasi via readFileSync
```
