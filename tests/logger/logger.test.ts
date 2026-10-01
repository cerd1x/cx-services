import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Logger, LogLevel, formatLog, isLogDebug, logger, sanitizeLogValue, setLogDebug } from "$services/shared/infra/logger";

async function waitFor(fn: () => void, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      fn();
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 10));
  }
  fn();
}

describe("LogLevel", () => {
  it("has correct values", () => {
    expect(LogLevel.Debug).toBe(0);
    expect(LogLevel.Info).toBe(1);
    expect(LogLevel.Warn).toBe(2);
    expect(LogLevel.Error).toBe(3);
  });

  it("is ordered by severity", () => {
    expect(LogLevel.Debug).toBeLessThan(LogLevel.Info);
    expect(LogLevel.Info).toBeLessThan(LogLevel.Warn);
    expect(LogLevel.Warn).toBeLessThan(LogLevel.Error);
  });
});

describe("formatLog", () => {
  it("formats string args", () => {
    const result = formatLog("INF", ["hello", "world"]);
    expect(result).toMatch(/^\[.*\] \[INF\] hello world\n$/);
  });

  it("formats object args as inline JSON", () => {
    const result = formatLog("ERR", [{ error: "fail" }]);
    expect(result).toMatch(/^\[.*\] \[ERR\] \{"error":"fail"\}\n$/);
  });

  it("formats mixed args", () => {
    const result = formatLog("DBG", ["count", 42, { key: "val" }]);
    expect(result).toMatch(/^\[.*\] \[DBG\] count 42 \{"key":"val"\}\n$/);
  });

  it("includes a valid ISO timestamp", () => {
    const result = formatLog("INF", ["test"]);
    const match = result.match(/^\[(.*?)\]/);
    expect(match).not.toBeNull();
    const d = new Date(match![1]);
    expect(d.getTime()).not.toBeNaN();
  });
});

describe("debug mode", () => {
  it("passes Error through so stack trace is shown when debug is on", () => {
    setLogDebug(true);
    try {
      const err = new Error("boom");
      expect(sanitizeLogValue(err)).toBe(err);
    } finally {
      setLogDebug(false);
    }
  });

  it("collapses Error to `name: message` when debug is off", () => {
    setLogDebug(false);
    try {
      expect(sanitizeLogValue(new Error("boom"))).toBe("Error: boom");
    } finally {
      setLogDebug(false);
    }
  });
});

describe("Logger", () => {
  let tempDir: string;
  let logFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "logger-test-"));
    logFile = join(tempDir, "test.log");
    logger.setLevel(LogLevel.Info);
    logger.setName("");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("singleton", () => {
    it("getInstance returns the same instance", () => {
      const a = Logger.getInstance();
      const b = Logger.getInstance();
      expect(a).toBe(b);
    });

    it("getInstance returns existing instance on second call", () => {
      const a = Logger.getInstance();
      const b = Logger.getInstance(LogLevel.Debug, logFile);
      expect(a).toBe(b);
    });

    it("subsequent getInstance calls return the same instance", () => {
      const a = Logger.getInstance();
      const b = Logger.getInstance();
      expect(a).toBe(b);
    });

    it("exported logger is the singleton instance", () => {
      expect(logger).toBe(Logger.getInstance());
    });
  });

  describe("level filtering", () => {
    const prevDebug = isLogDebug();

    beforeEach(() => {
      setLogDebug(false);
    });

    afterEach(() => {
      setLogDebug(prevDebug);
    });

    it("debug is suppressed at default Info level", () => {
      const spy = spyOn(console, "debug").mockImplementation(() => {});
      logger.debug("should not appear");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("debug is logged after setting Debug level", () => {
      logger.setLevel(LogLevel.Debug);
      const spy = spyOn(console, "debug").mockImplementation(() => {});
      logger.debug("visible");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("🐛"), "visible");
      spy.mockRestore();
    });

    it("info is logged at default Info level", () => {
      logger.setLevel(LogLevel.Info);
      const spy = spyOn(console, "info").mockImplementation(() => {});
      logger.info("info msg");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("ℹ"), "info msg");
      spy.mockRestore();
    });

    it("info is suppressed at Warn level", () => {
      logger.setLevel(LogLevel.Warn);
      const spy = spyOn(console, "info").mockImplementation(() => {});
      logger.info("should not appear");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("console output", () => {
    it("debug prints prefixed message", () => {
      logger.setLevel(LogLevel.Debug);
      const spy = spyOn(console, "debug").mockImplementation(() => {});
      logger.debug("a", "b");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("🐛"), "a", "b");
      spy.mockRestore();
    });

    it("info prints prefixed message", () => {
      const spy = spyOn(console, "info").mockImplementation(() => {});
      logger.info("hello");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("ℹ"), "hello");
      spy.mockRestore();
    });

    it("warn prints prefixed message", () => {
      const spy = spyOn(console, "warn").mockImplementation(() => {});
      logger.warn("warning");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("⚠"), "warning");
      spy.mockRestore();
    });

    it("error prints prefixed message", () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      logger.error("fail");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("✗"), "fail");
      spy.mockRestore();
    });
  });

  describe("file output", () => {
    const originalDev = (import.meta as any).env?.DEV;

    beforeEach(() => {
      if (!(import.meta as any).env) (import.meta as any).env = {};
      (import.meta as any).env.DEV = true;
    });

    afterEach(() => {
      if (originalDev !== undefined) {
        (import.meta as any).env.DEV = originalDev;
      } else {
        delete (import.meta as any).env.DEV;
      }
    });

    it("writes a log line to the file", async () => {
      logger.setLogFile(logFile);
      logger.info("write test");
      await waitFor(() => {
        const content = readFileSync(logFile, "utf-8");
        expect(content).toMatch(/\[INF\] write test\n$/);
      });
    });

    it("appends multiple levels to the file", async () => {
      logger.setLogFile(logFile);
      logger.info("first");
      logger.warn("second");
      logger.error("third");
      await waitFor(() => {
        const lines = readFileSync(logFile, "utf-8").trim().split("\n");
        expect(lines).toHaveLength(3);
        expect(lines[0]).toMatch(/\[INF\] first$/);
        expect(lines[1]).toMatch(/\[WRN\] second$/);
        expect(lines[2]).toMatch(/\[ERR\] third$/);
      });
    });

    it("does not write when no logFile is set", async () => {
      writeFileSync(logFile, "original");
      logger.info("should not appear");
      await new Promise((r) => setTimeout(r, 100));
      expect(readFileSync(logFile, "utf-8")).toBe("original");
    });
  });
});
