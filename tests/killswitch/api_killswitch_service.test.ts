import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  ApiKillswitchService,
  createApiKillswitchService,
} from "$services/domain/killswitch";
import type { ApiKillswitchRepository } from "$services/domain/killswitch/core/ports/out/api-killswitch-repository.port";
import type { ApiKillswitch } from "$services/domain/killswitch/core/model/api-killswitch.model";
import { ValidationError } from "$services/shared/kernel/errors/service-error";

describe("ApiKillswitchService dengan mock repository", () => {
  const entries = new Map<string, ApiKillswitch>();

  const mockRepo = {
    listDisabled: mock(async () => [...entries.values()]),
    isDisabled: mock(async (operation: string) => {
      const found = entries.get(operation);
      return found
        ? { disabled: true, reason: found.reason ?? null }
        : { disabled: false, reason: null };
    }),
    disable: mock(async (operation: string, reason?: string) => {
      const entry: ApiKillswitch = {
        operation,
        reason,
        disabledAt: new Date("2026-10-03T00:00:00Z"),
      };
      entries.set(operation, entry);
      return entry;
    }),
    enable: mock(async (operation: string) => entries.delete(operation)),
    invalidateCache: mock(),
  } satisfies ApiKillswitchRepository;

  let service: ApiKillswitchService;

  beforeEach(() => {
    entries.clear();
    service = createApiKillswitchService({ killswitchRepo: mockRepo });
  });

  it("operation yang tidak ada switch-nya dianggap aktif", async () => {
    expect(await service.isOperationDisabled("Query.transactions")).toEqual({
      disabled: false,
      reason: null,
    });
  });

  it("menonaktifkan operation dan alasannya tersimpan", async () => {
    const entry = await service.disableOperation("Mutation.createTransaction", "incident #42");

    expect(entry.operation).toBe("Mutation.createTransaction");
    expect(entry.reason).toBe("incident #42");
    expect(await service.isOperationDisabled("Mutation.createTransaction")).toEqual({
      disabled: true,
      reason: "incident #42",
    });
  });

  it("operation lain tidak terpengaruh saat satu dimatikan", async () => {
    await service.disableOperation("Mutation.createTransaction");

    expect(await service.isOperationDisabled("Query.transactions")).toEqual({
      disabled: false,
      reason: null,
    });
  });

  it("menghidupkan kembali operation", async () => {
    await service.disableOperation("Query.statistic");
    const result = await service.enableOperation("Query.statistic");

    expect(result).toEqual({ operation: "Query.statistic", enabled: true, changed: true });
    expect(await service.isOperationDisabled("Query.statistic")).toEqual({
      disabled: false,
      reason: null,
    });
  });

  it("menandai changed=false saat enable operation yang tidak dimatikan", async () => {
    expect(await service.enableOperation("Query.transactions")).toEqual({
      operation: "Query.transactions",
      enabled: true,
      changed: false,
    });
  });

  it("menolak operation key yang bukan bentuk Type.field", async () => {
    await expect(service.disableOperation("createTransaction")).rejects.toThrow(ValidationError);
    await expect(service.disableOperation("Nope.createTransaction")).rejects.toThrow(
      ValidationError,
    );
  });

  it("operation Subscription tidak bisa dimatikan lewat API", async () => {
    await expect(service.disableOperation("Subscription.onTransaction")).rejects.toThrow(
      ValidationError,
    );
  });

  it("listDisabled mengembalikan seluruh switch aktif", async () => {
    await service.disableOperation("Query.a", "satu");
    await service.disableOperation("Mutation.b");

    const list = await service.listDisabledOperations();
    expect(list.map((i) => i.operation).sort()).toEqual(["Mutation.b", "Query.a"]);
  });
});