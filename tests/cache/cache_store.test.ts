import { describe, expect, it } from "bun:test";
import {
  createCacheStore,
  getOrSet,
  MemoryCacheStore,
  WorkerCacheStore,
  type CacheStore,
} from "$services/shared/infra/cache";

/** Inisialisasi workerd palsu: `caches.open()` yang menyimpan Response di memori. */
class FakeCacheStorage {
  #caches = new Map<string, Map<string, { body: string; cacheControl: string }>>();

  open(namespace: string) {
    let cache = this.#caches.get(namespace);
    if (!cache) {
      cache = new Map();
      this.#caches.set(namespace, cache);
    }
    const entry = cache;
    return Promise.resolve({
      match: (key: string) => {
        const found = entry.get(key);
        if (!found) return Promise.resolve(undefined);
        return Promise.resolve(
          new Response(found.body, { headers: { "cache-control": found.cacheControl } }),
        );
      },
      put: async (key: string, response: unknown) => {
        const res = response as Response;
        entry.set(key, {
          body: await res.text(),
          cacheControl: res.headers.get("cache-control") ?? "",
        });
      },
      delete: async (key: string) => entry.delete(key),
    });
  }

  dump(namespace: string): Array<{ key: string; body: string; cacheControl: string }> {
    const cache = this.#caches.get(namespace) ?? new Map();
    return [...cache].map(([key, v]) => ({ key, body: v.body, cacheControl: v.cacheControl }));
  }
}

describe("MemoryCacheStore (backend Bun)", () => {
  it("set/get/overwrite/delete", async () => {
    const store = new MemoryCacheStore("t1");

    expect(await store.get("k")).toBeUndefined();
    expect(await store.delete("k")).toBe(false);

    await store.set("k", { a: 1 }, 5_000);
    expect(await store.get<{ a: number }>("k")).toEqual({ a: 1 });

    await store.set("k", "baru", 5_000);
    expect(await store.get<string>("k")).toBe("baru");

    expect(await store.delete("k")).toBe(true);
    expect(await store.get("k")).toBeUndefined();
  });

  it("kedaluwarsa TTL dicek saat baca", async () => {
    const store = new MemoryCacheStore("t2");
    await store.set("k", "v", 30);
    expect(await store.get<string>("k")).toBe("v");
    await Bun.sleep(40);
    expect(await store.get("k")).toBeUndefined();
  });

  it("namespace memisahkan key", async () => {
    const a = new MemoryCacheStore("ns-a");
    const b = new MemoryCacheStore("ns-b");
    await a.set("shared", "milik-a", 5_000);
    expect(await b.get("shared")).toBeUndefined();
    expect(await a.get<string>("shared")).toBe("milik-a");
  });

  it("nilai object disimpan apa adanya (referensi sama)", async () => {
    const store = new MemoryCacheStore("t3");
    const value = { nested: { n: 1 } };
    await store.set("k", value, 5_000);
    const got = await store.get<typeof value>("k");
    expect(got).toBe(value);
  });
});

describe("WorkerCacheStore (backend Workers)", () => {
  it("set/get/delete lewat Web Cache API", async () => {
    const fake = new FakeCacheStorage();
    const store: CacheStore = new WorkerCacheStore("cxapp", fake);

    await store.set("killswitch:ops", ["Mutation.signUp"], 5_000);
    expect(await store.get<string[]>("killswitch:ops")).toEqual(["Mutation.signUp"]);
    expect(fake.dump("cxapp")).toHaveLength(1);

    expect(await store.delete("killswitch:ops")).toBe(true);
    expect(await store.get<string[]>("killswitch:ops")).toBeUndefined();
  });

  it("nilai diserialisasi JSON + TTL jadi Cache-Control", async () => {
    const fake = new FakeCacheStorage();
    const store = new WorkerCacheStore("cxapp", fake);

    await store.set("k", { uang: 1500 }, 90_000);
    const [entry] = fake.dump("cxapp");
    expect(JSON.parse(entry.body)).toEqual({ uang: 1500 });
    expect(entry.cacheControl).toBe("public, max-age=90");
    // key dipetakan ke URL GET internal
    expect(entry.key.startsWith("https://cache.cxapp.internal/")).toBe(true);
  });

  it("match miss mengembalikan undefined", async () => {
    const store = new WorkerCacheStore("cxapp", new FakeCacheStorage());
    expect(await store.get("tidak-ada")).toBeUndefined();
  });

  it("gagal jelas kalau dipakai di luar runtime Workers", () => {
    // bun test tidak punya globalThis.caches
    expect(() => new WorkerCacheStore("cxapp", undefined)).toThrow(/Workers/);
  });
});

describe("createCacheStore", () => {
  it("di runtime Bun (tanpa globalThis.caches) memilih backend memory", () => {
    const store = createCacheStore("v1");
    expect(store.name).toBe("memory");
    expect(store).toBeInstanceOf(MemoryCacheStore);
  });

  it("getOrSet memuat sekali lalu memakai cache", async () => {
    const store = new MemoryCacheStore("t4");
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { nilai: calls };
    };

    const first = await getOrSet(store, "statistik", 5_000, loader);
    const second = await getOrSet(store, "statistik", 5_000, loader);

    expect(calls).toBe(1);
    expect(second).toEqual(first);
  });

  it("getOrSet key berbeda memuat terpisah", async () => {
    const store = new MemoryCacheStore("t5");
    const a = await getOrSet(store, "a", 5_000, async () => "A");
    const b = await getOrSet(store, "b", 5_000, async () => "B");
    expect(a).toBe("A");
    expect(b).toBe("B");
  });
});
