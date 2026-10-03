import { Database } from "bun:sqlite";

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

const DDL = [
  `CREATE TABLE IF NOT EXISTS "user" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS "asset" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash' CHECK(type IN ('bank','ewallet','cash','loan','crypto')),
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS "asset_mutation" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES "asset"(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('add','subtract','transaction','swap')),
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    balance_before TEXT NOT NULL,
    balance_after TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS "transaction" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('income','expense','transfer','outcome')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed')),
    payment_method TEXT NOT NULL DEFAULT '{"type":"cash"}',
    customer_id INTEGER,
    amount TEXT NOT NULL,
    capital TEXT NOT NULL,
    description TEXT,
    category TEXT,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS "transaction_user_id_created_at_id_idx" ON "transaction" ("user_id","created_at","id")`,
  `CREATE TABLE IF NOT EXISTS "product" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    capital REAL,
    currency TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    track_stock INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "order" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','cancelled')),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','bank_transfer','ewallet','credit_card','debit_card','credit')),
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    item_count INTEGER NOT NULL,
    description TEXT,
    customer_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS "contact" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    "group" TEXT,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT (current_timestamp),
    updated_at TEXT DEFAULT (current_timestamp)
  )`,
  `CREATE INDEX IF NOT EXISTS "contact_user_id_id_idx" ON "contact" ("user_id","id")`,
  `CREATE TABLE IF NOT EXISTS "session" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS "setting" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    currency TEXT NOT NULL DEFAULT 'IDR',
    dark_mode INTEGER NOT NULL DEFAULT 0,
    date_format TEXT NOT NULL DEFAULT 'd MMM yyyy, HH:mm',
    created_at TEXT NOT NULL DEFAULT (current_timestamp),
    updated_at TEXT NOT NULL DEFAULT (current_timestamp)
  )`,
  `CREATE TABLE IF NOT EXISTS "api_killswitch" (
    operation TEXT PRIMARY KEY NOT NULL,
    reason TEXT,
    disabled_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS "token" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    session_token TEXT,
    refresh_token TEXT,
    expired_at_session TEXT NOT NULL,
    expired_at_refresh TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "invoice" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES "contact"(id) ON DELETE SET NULL,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','paid','partially_paid','overdue','cancelled')),
    issued_at INTEGER,
    due_at INTEGER,
    paid_at INTEGER,
    description TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS "payment" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES "invoice"(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('cash','bank_transfer','ewallet','credit_card','debit_card','credit')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed','refunded','cancelled')),
    gateway_ref TEXT,
    description TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS "outbox" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correlation_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

export function initTestTables(sqlite: Database) {
  for (const ddl of DDL) {
    sqlite.run(ddl);
  }
}
