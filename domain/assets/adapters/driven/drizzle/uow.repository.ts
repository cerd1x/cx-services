import { getDB } from "$services/shared/infra/db";
import { D1TxCollector } from "$services/shared/infra/db/d1-tx-collector";
import { UnitOfWork } from "$services/shared/kernel/uow.port";

export class UnitOfWorkImpl extends UnitOfWork {
  async run<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const db = getDB();
    const client = (db as any).$client;

    const isD1 = client && typeof client.batch === "function";

    if (isD1) {
      const collector = new D1TxCollector();
      const result = await fn(collector);
      await collector.flush();
      return result;
    }

    return (db as any).transaction(async (tx: unknown) => fn(tx));
  }
}
