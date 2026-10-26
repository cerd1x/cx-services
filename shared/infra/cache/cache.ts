/**
 * Cache in-process (per-isolate) dengan TTL.
 *
 * Nilai disimpan langsung di memori sebagai referensi aslinya, jadi hanya tepat
 * untuk state ephemeral yang hidup di satu isolate/kontainer request (mis. token
 * CSRF sekali pakai). Isolate lain tidak melihat isinya.
 *
 * Untuk cache lintas-isolate (mis. hasil query D1 yang dibaca tiap request di
 * beberapa isolate), pakai `createCacheStore` dari `cache.store.ts` — di
 * Workers ia memanfaatkan Web Cache API sehingga dibagi antar isolate.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class Cache<V = unknown> {
  #store = new Map<string, CacheEntry<V>>();
  #defaultTTL: number;

  constructor(defaultTTLms = 60_000) {
    this.#defaultTTL = defaultTTLms;
  }

  set(key: string, value: V, ttlMs?: number): void {
    this.#store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.#defaultTTL),
    });
  }

  get(key: string): V | undefined {
    const entry = this.#store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }

  get size(): number {
    this.#purgeExpired();
    return this.#store.size;
  }

  #purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.#store) {
      if (now > entry.expiresAt) this.#store.delete(key);
    }
  }
}
