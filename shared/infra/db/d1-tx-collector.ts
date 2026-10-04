import { getD1 } from "./client";

export const D1_TX = Symbol("D1TxCollector");

export class D1TxCollector {
  [D1_TX] = true;

  #stmts: { sql: string; params: unknown[] }[] = [];

  add(sql: string, params: unknown[]): void {
    this.#stmts.push({ sql, params: params ?? [] });
  }

  get size() {
    return this.#stmts.length;
  }

  async flush(): Promise<any[]> {
    if (this.#stmts.length === 0) return [];
    const d1 = getD1();
    const prepared = this.#stmts.map((s) => d1.prepare(s.sql).bind(...s.params));
    this.#stmts = [];
    return d1.batch(prepared);
  }

  static is(value: unknown): value is D1TxCollector {
    return typeof value === "object" && value !== null && D1_TX in value;
  }
}
