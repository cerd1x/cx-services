import { eq, inArray } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { D1TxCollector } from "$services/shared/infra/db/d1-tx-collector";
import { outboxTable } from "$services/shared/infra/db/drizzle-schema";
import {
  OutboxRepository,
  type OutboxEvent,
} from "$services/shared/kernel/outbox/outbox-repository.port";

type DB = ReturnType<typeof getDB>;

export class OutboxRepositoryImpl implements OutboxRepository {
  async save(event: OutboxEvent, tx?: unknown): Promise<void> {
    if (D1TxCollector.is(tx)) {
      const db = getDB() as DB;
      const q = db
        .insert(outboxTable)
        .values({
          correlationId: event.correlationId,
          eventType: event.eventType,
          payload: event.payload,
        })
        .toSQL();
      tx.add(q.sql, q.params as unknown[]);
      return;
    }

    const db = (tx ?? getDB()) as DB;
    await db.insert(outboxTable).values({
      correlationId: event.correlationId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }

  async findUnprocessed(limit = 50): Promise<(OutboxEvent & { id: number })[]> {
    const db = getDB() as DB;
    const rows = await db
      .select()
      .from(outboxTable)
      .where(eq(outboxTable.processed, false))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      correlationId: r.correlationId,
      eventType: r.eventType,
      payload: r.payload,
    }));
  }

  async markProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = getDB() as DB;
    await db
      .update(outboxTable)
      .set({ processed: true })
      .where(inArray(outboxTable.id, ids));
  }

  async markProcessedByCorrelation(correlationId: string): Promise<void> {
    const db = getDB() as DB;
    await db
      .update(outboxTable)
      .set({ processed: true })
      .where(eq(outboxTable.correlationId, correlationId));
  }
}