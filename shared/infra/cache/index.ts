/**
 * Public entry modul cache.
 *
 * - `Cache` — cache in-process per-isolate (sync) untuk state ephemeral
 *   yang hidup di satu isolate (token sekali pakai, dsb).
 * - `createCacheStore` / `CacheStore` — lintas-runtime: otomatis Web Cache API
 *   di Workers, `Map` di Bun. Untuk cache lintas-isolate (D1/GraphQL dsb).
 */

export { Cache } from "./cache";
export {
  createCacheStore,
  getOrSet,
  MemoryCacheStore,
  WorkerCacheStore,
  type CacheStore,
} from "./cache.store";
