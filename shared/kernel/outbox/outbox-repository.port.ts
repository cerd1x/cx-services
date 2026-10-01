export type OutboxEvent = {
  correlationId: string;
  eventType: string;
  payload: string;
};

export abstract class OutboxRepository {
  abstract save(event: OutboxEvent, tx?: unknown): Promise<void>;
  abstract findUnprocessed(limit?: number): Promise<(OutboxEvent & { id: number })[]>;
  abstract markProcessed(ids: number[]): Promise<void>;
  abstract markProcessedByCorrelation(correlationId: string): Promise<void>;
}