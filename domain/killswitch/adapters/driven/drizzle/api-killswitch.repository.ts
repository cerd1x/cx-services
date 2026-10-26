import { desc, eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { apiKillswitchTable } from "$services/shared/infra/db/drizzle-schema";
import { ApiKillswitchRepository } from "../../../core/ports/out/api-killswitch-repository.port";
import type {
  ApiKillswitch,
  DisabledState,
} from "../../../core/ports/out/api-killswitch-repository.port";
import { createCacheStore, getOrSet } from "$services/shared/infra/cache";

/**
 * TTL cache untuk daftar operation yang dimatikan.
 *
 * Kill switch dibaca pada setiap request GraphQL, jadi query D1 per request
 * terlalu mahal untuk sesuatu yang berubah jarang.
 *
 * Cache-nya lintas-runtime: di Workers (`workerd`) backend Web Cache API
 * sehingga cache dibagi antar isolate di satu edge site; di Bun (dev/test)
 * fallbacknya `Map` per process. Isolate berbeda bisa melihat daftar basi
 * paling lama `DEFAULT_TTL_MS` setelah ditulis (D1 tidak punya pub/sub), tapi
 * biaya per request tetap O(1).
 *
 * Daftar yang di-cache sengaja kecil (jumlah switch aktif), jadi menyimpan
 * seluruh baris — bukan cuma himpunan key — tetap satu query dan sederhana.
 * `disable()`/`enable()` menginvalidasi cache yang dilihat isolate yang
 * menulis; isolate lain akan melihat efeknya setelah TTL habis.
 */
const DEFAULT_TTL_MS = 5_000;
const CACHE_KEY = "disabled-operations";
const CACHE_NAMESPACE = "killswitch";

function toEntry(row: typeof apiKillswitchTable.$inferSelect): ApiKillswitch {
  return {
    operation: row.operation,
    reason: row.reason ?? undefined,
    disabledAt: row.disabledAt,
  };
}

export class ApiKillswitchRepositoryImpl implements ApiKillswitchRepository {
  readonly #cache = createCacheStore(CACHE_NAMESPACE);

  async listDisabled(): Promise<ApiKillswitch[]> {
    return this.#entries();
  }

  async isDisabled(operation: string): Promise<DisabledState> {
    const found = (await this.#entries()).find((entry) => entry.operation === operation);
    if (!found) return { disabled: false, reason: null };
    return { disabled: true, reason: found.reason ?? null };
  }

  async disable(operation: string, reason?: string): Promise<ApiKillswitch> {
    const now = new Date();
    await getDB()
      .insert(apiKillswitchTable)
      .values({ operation, reason: reason ?? null, disabledAt: now })
      .onConflictDoUpdate({
        target: apiKillswitchTable.operation,
        set: { reason: reason ?? null, disabledAt: now },
      });

    await this.invalidateCache();
    return { operation, reason, disabledAt: now };
  }

  async enable(operation: string): Promise<boolean> {
    const deleted = await getDB()
      .delete(apiKillswitchTable)
      .where(eq(apiKillswitchTable.operation, operation))
      .returning({ operation: apiKillswitchTable.operation });

    await this.invalidateCache();
    return deleted.length > 0;
  }

  async invalidateCache(): Promise<void> {
    await this.#cache.delete(CACHE_KEY);
  }

  async #entries(): Promise<ApiKillswitch[]> {
    return getOrSet(this.#cache, CACHE_KEY, DEFAULT_TTL_MS, async () => {
      const rows = await getDB()
        .select()
        .from(apiKillswitchTable)
        .orderBy(desc(apiKillswitchTable.disabledAt));
      return rows.map((row) => toEntry(row));
    });
  }
}
