import { desc, eq } from "drizzle-orm";
import { getDB } from "$services/shared/infra/db";
import { apiKillswitchTable } from "$services/shared/infra/db/drizzle-schema";
import { ApiKillswitchRepository } from "../../../core/ports/out/api-killswitch-repository.port";
import type {
  ApiKillswitch,
  DisabledState,
} from "../../../core/ports/out/api-killswitch-repository.port";
import { Cache } from "$services/shared/infra/cache";

/**
 * TTL cache untuk daftar operation yang dimatikan.
 *
 * Kill switch dibaca pada setiap request GraphQL, jadi query D1 per request
 * terlalu mahal untuk sesuatu yang berubah jarang. TTL pendek adalah
 * kompromi: isolate lain melihat switch paling lama `ttlMs` setelah ditulis
 * (D1 tidak punya pub/sub), tapi biaya per request tetap O(1).
 *
 * Daftar yang di-cache sengaja kecil (jumlah switch aktif), jadi menyimpan
 * seluruh baris — bukan cuma himpunan key — tetap satu query dan sederhana.
 *
 * Cache ini per-isolate. `disable()`/`enable()` menginvalidasi cache lokal
 * sehingga isolate yang melayani request kontrol langsung melihat efeknya.
 */
const DEFAULT_TTL_MS = 5_000;
const CACHE_KEY = "disabled-operations";

function toEntry(row: typeof apiKillswitchTable.$inferSelect): ApiKillswitch {
  return {
    operation: row.operation,
    reason: row.reason ?? undefined,
    disabledAt: row.disabledAt,
  };
}

export class ApiKillswitchRepositoryImpl implements ApiKillswitchRepository {
  readonly #cache = new Cache<ApiKillswitch[]>(DEFAULT_TTL_MS);

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

    this.invalidateCache();
    return { operation, reason, disabledAt: now };
  }

  async enable(operation: string): Promise<boolean> {
    const deleted = await getDB()
      .delete(apiKillswitchTable)
      .where(eq(apiKillswitchTable.operation, operation))
      .returning({ operation: apiKillswitchTable.operation });

    this.invalidateCache();
    return deleted.length > 0;
  }

  invalidateCache(): void {
    this.#cache.delete(CACHE_KEY);
  }

  async #entries(): Promise<ApiKillswitch[]> {
    const cached = this.#cache.get(CACHE_KEY);
    if (cached) return cached;

    const rows = await getDB()
      .select()
      .from(apiKillswitchTable)
      .orderBy(desc(apiKillswitchTable.disabledAt));

    const entries = rows.map(toEntry);
    this.#cache.set(CACHE_KEY, entries);
    return entries;
  }
}