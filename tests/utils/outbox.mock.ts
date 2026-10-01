import { OutboxRepository } from "$services/shared/kernel/outbox/outbox-repository.port";
import type { AssetSwapGateway } from "$services/domain/transactions";

type OutboxRow = { id: number; correlationId: string; eventType: string; payload: string; processed: boolean };

export class InMemoryOutboxRepository extends OutboxRepository {
  rows: OutboxRow[] = [];
  #seq = 1;

  async save(event: {
    correlationId: string;
    eventType: string;
    payload: string;
  }): Promise<void> {
    this.rows.push({
      id: this.#seq++,
      correlationId: event.correlationId,
      eventType: event.eventType,
      payload: event.payload,
      processed: false,
    });
  }

  async findUnprocessed(): Promise<
    { id: number; correlationId: string; eventType: string; payload: string }[]
  > {
    return this.rows.filter((r) => !r.processed);
  }

  async markProcessed(ids: number[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.find((r) => r.id === id);
      if (row) row.processed = true;
    }
  }

  async markProcessedByCorrelation(correlationId: string): Promise<void> {
    for (const row of this.rows) {
      if (row.correlationId === correlationId) row.processed = true;
    }
  }
}

export const mockAssetSwapGateway: AssetSwapGateway = {
  mutateSwapAsset: async () => {
    throw new Error("mutateSwapAsset mock not implemented");
  },
};