export type EventHandler<T = Record<string, unknown>> = (payload: T) => Promise<void>;

export class EventBus {
  static #handlers = new Map<string, EventHandler[]>();

  static on<T extends Record<string, unknown>>(eventType: string, handler: EventHandler<T>): void {
    const existing = EventBus.#handlers.get(eventType) ?? [];
    existing.push(handler as EventHandler);
    EventBus.#handlers.set(eventType, existing);
  }

  static off(eventType: string, handler: EventHandler): void {
    const existing = EventBus.#handlers.get(eventType);
    if (!existing) return;
    EventBus.#handlers.set(
      eventType,
      existing.filter((h) => h !== handler),
    );
  }

  static async dispatchEvent<T extends Record<string, unknown>>(
    eventType: string,
    payload: T,
  ): Promise<void> {
    const handlers = EventBus.#handlers.get(eventType) ?? [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}