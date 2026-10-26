/**
 * Cache lintas-runtime untuk `cx-services`.
 *
 * Aturan penyimpanannya:
 *
 * - **Cloudflare Workers (runtime `workerd`)** — backend `workers-cache`:
 *   nilai diserialisasi JSON di badan `Response`, lalu disimpan via Web Cache
 *   API (`caches.open(namespace)`). Cache dibagi antar isolate di satu edge
 *   site, dan TTL-nya diterapkan lewat `Cache-Control: max-age=<detik>`.
 * - **Bun (lokal, test, dev Elysia)** — backend `memory`: nilai disimpan
 *   langsung (tanpa serialisasi) di `Map` in-process dengan TTL sendiri.
 *
 * Nilai yang disimpan **harus JSON-serializable** supaya perilaku kedua backend
 * konsisten saat kode yang sama dipakai di Bun dan di Workers.
 */

const DEFAULT_NAMESPACE = "cxapp";
const DEFAULT_TTL_MS = 60_000;

/**
 * Bentuk `Cache`/`CacheStorage` structural, biar tidak tergantung
 * `@cloudflare/workers-types` maupun lib.dom (Bun punya bentuk sendiri).
 */
interface WorkerCacheResponse {
  text(): Promise<string>;
}

interface WorkerCache {
  match(key: string): Promise<WorkerCacheResponse | undefined>;
  put(key: string, response: WorkerCacheResponse): Promise<unknown>;
  delete(key: string): Promise<boolean>;
}

interface WorkerCacheStorage {
  open(namespace: string): Promise<WorkerCache>;
}

export interface CacheStore {
  readonly name: string;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/**
 * Backend `memory` untuk Bun: satu `Map` per instance, TTL dicek saat baca.
 * Namespace hanya berdampak sebagai prefix key, supaya dua store dengan
 * namespace berbeda tidak saling bentrok (perilaku sama dengan backend
 * `workers-cache`, yang membentuk cache dari nama namespace-nya).
 */
export class MemoryCacheStore implements CacheStore {
  readonly name = "memory";
  #entries = new Map<string, { value: unknown; expiresAt: number }>();
  #namespace: string;

  constructor(namespace = DEFAULT_NAMESPACE) {
    this.#namespace = namespace;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const fullKey = this.#fullKey(key);
    const entry = this.#entries.get(fullKey);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.#entries.delete(fullKey);
      return undefined;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    this.#entries.set(this.#fullKey(key), {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.#entries.delete(this.#fullKey(key));
  }

  #fullKey(key: string): string {
    return `${this.#namespace}:${key}`;
  }
}

/**
 * Backend untuk runtime Workers (`globalThis.caches` tersedia di workerd).
 *
 * Key dijadikan URL GET pada origin internal (tidak ada di DNS publik),
 * nilai disimpan sebagai `Response` JSON dengan `Cache-Control` yang menentukan
 * TTL-nya. `match()` yang miss mengembalikan `undefined` tanpa fallback origin.
 */
export class WorkerCacheStore implements CacheStore {
  readonly name = "workers-cache";
  #ready: Promise<WorkerCache>;

  constructor(namespace = DEFAULT_NAMESPACE, storage?: WorkerCacheStorage) {
    const source = storage ?? runtimeCacheStorage();
    if (!source) {
      throw new Error("WorkerCacheStore butuh runtime Workers (globalThis.caches tidak tersedia)");
    }
    this.#ready = source.open(namespace);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const cache = await this.#ready;
    const hit = await cache.match(toCacheUrl(key));
    if (!hit) return undefined;
    return JSON.parse(await hit.text()) as T;
  }

  async set(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const cache = await this.#ready;
    const maxAge = Math.max(1, Math.ceil(ttlMs / 1000));
    await cache.put(
      toCacheUrl(key),
      new Response(JSON.stringify(value), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${maxAge}`,
        },
      }),
    );
  }

  async delete(key: string): Promise<boolean> {
    const cache = await this.#ready;
    return cache.delete(toCacheUrl(key));
  }
}

/**
 * Pilih backend sesuai runtime: workerd → Web Cache API, selain itu → memori.
 */
export function createCacheStore(namespace = DEFAULT_NAMESPACE): CacheStore {
  const storage = runtimeCacheStorage();
  return storage ? new WorkerCacheStore(namespace, storage) : new MemoryCacheStore(namespace);
}

/**
 * Baca dari cache; kalau miss, jalankan `loader`, simpan hasilnya, lalu
 * kembalikan nilai itu. Nilai `undefined` dari loader tidak ter-cache.
 */
export async function getOrSet<T>(
  store: CacheStore,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await store.get<T>(key);
  if (cached !== undefined) return cached;
  const value = await loader();
  await store.set(key, value, ttlMs);
  return value;
}

function runtimeCacheStorage(): WorkerCacheStorage | undefined {
  return (globalThis as unknown as { caches?: WorkerCacheStorage }).caches;
}

function toCacheUrl(key: string): string {
  return `https://cache.cxapp.internal/${encodeURIComponent(key)}`;
}
