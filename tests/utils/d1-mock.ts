import { Database } from "bun:sqlite";
import { buildDdl } from "./d1-ddl";
import {
  apiKillswitchTable,
  assetMutationTable,
  assetTable,
  contactTable,
  geminiTokenTable,
  invoiceTable,
  orderTable,
  outboxTable,
  passkeyTable,
  paymentTable,
  productTable,
  settingTable,
  tokenTable,
  transactionTable,
  userTable,
} from "$services/shared/infra/db/drizzle-schema";

const allTestTables = [
  userTable,
  tokenTable,
  passkeyTable,
  assetTable,
  assetMutationTable,
  contactTable,
  productTable,
  transactionTable,
  settingTable,
  orderTable,
  invoiceTable,
  paymentTable,
  outboxTable,
  geminiTokenTable,
  apiKillswitchTable,
];

export class D1MockStatement {
  private _db: Database;
  readonly sql: string;
  bound: unknown[] | null = null;

  constructor(sql: string, db: Database) {
    this.sql = sql;
    this._db = db;
  }

  bind(...values: unknown[]) {
    this.bound = values;
    return this as any;
  }

  async first<T = unknown>(col?: string): Promise<T> {
    const stmt = this._db.prepare(this.sql);
    let row: Record<string, unknown> | undefined;
    if (this.bound) {
      row = stmt.get(...(this.bound as any[])) as Record<string, unknown> | undefined;
    } else {
      row = stmt.get() as Record<string, unknown> | undefined;
    }
    if (col && row) return row[col] as T;
    return row as T;
  }

  async run<T = unknown>(): Promise<{
    success: boolean;
    results: T[];
    meta: Record<string, unknown>;
  }> {
    const stmt = this._db.prepare(this.sql);
    if (this.bound) {
      stmt.run(...(this.bound as any[]));
    } else {
      stmt.run();
    }
    return { success: true, results: [], meta: { changed_db: true } };
  }

  async all<T = unknown>(): Promise<{
    success: boolean;
    results: T[];
    meta: Record<string, unknown>;
  }> {
    const stmt = this._db.prepare(this.sql);
    let rows: T[];
    if (this.bound) {
      rows = stmt.all(...(this.bound as any[])) as T[];
    } else {
      rows = stmt.all() as T[];
    }
    return { success: true, results: rows, meta: {} };
  }

  async raw<T = unknown>(): Promise<T[]> {
    const stmt = this._db.prepare(this.sql);
    let rows: Record<string, unknown>[];
    if (this.bound) {
      rows = stmt.all(...(this.bound as any[])) as Record<string, unknown>[];
    } else {
      rows = stmt.all() as Record<string, unknown>[];
    }
    return rows.map((r) => Object.values(r)) as unknown as T[];
  }

  static execBatch(sqlite: Database, stmts: D1MockStatement[]) {
    const results: any[] = [];
    for (const stmt of stmts) {
      const s = sqlite.prepare(stmt.sql);
      if (stmt.bound) {
        s.run(...(stmt.bound as any[]));
      } else {
        s.run();
      }
      results.push({ success: true, meta: { changed_db: true } });
    }
    return results;
  }
}

export function createMockD1(): {
  sqlite: Database;
  d1: {
    prepare(sql: string): D1MockStatement;
    batch(statements: D1MockStatement[]): Promise<
      {
        success: boolean;
        meta: { changed_db: boolean };
      }[]
    >;
    dump(): Promise<ArrayBuffer>;
    exec(sql: string): Promise<{ success: boolean; meta: {} }>;
  };
  close: () => void;
} {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");

  const d1 = {
    prepare(sql: string) {
      return new D1MockStatement(sql, sqlite);
    },
    async batch(statements: D1MockStatement[]) {
      return D1MockStatement.execBatch(sqlite, statements);
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async exec(sql: string) {
      sqlite.run(sql);
      return { success: true, meta: {} };
    },
  };

  return { sqlite, d1, close: () => sqlite.close() };
}

/**
 * DDL diambil dari drizzle schema saat runtime lewat {@link buildDdl}, bukan
 * ditulis tangan. Lihat `d1-ddl.ts` untuk alasannya.
 */
const DDL = buildDdl(allTestTables);

export function initTestTables(sqlite: Database) {
  for (const ddl of DDL) {
    sqlite.run(ddl);
  }
}
