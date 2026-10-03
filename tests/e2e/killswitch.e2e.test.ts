import { beforeEach, describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";
import { apiKillswitchService } from "$services/domain/killswitch";

/**
 * Kill switch diuji lewat GraphQL sungguhan, bukan unit test transformer,
 * karena nilai yang dijaga adalah perilaku end-to-end: operation yang
 * dimatikan harus benar-benar tidak dijangkau resolver.
 */
describe("api killswitch e2e", () => {
  e2eLifecycle();

  beforeEach(async () => {
    for (const entry of await apiKillswitchService.listDisabledOperations()) {
      await apiKillswitchService.enableOperation(entry.operation);
    }
  });

  it("operation yang aktif tetap berjalan", async () => {
    const { session } = await signUpUser();
    const { data, errors } = await gql<{ transactions: unknown[] }>(
      `{ transactions { id } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.transactions).toBeArray();
  });

  it("operation yang dimatikan ditolak dengan pesan dan code 503", async () => {
    const { session } = await signUpUser();
    await apiKillswitchService.disableOperation("Query.transactions", "uji insiden");

    const { errors } = await gql<{ transactions: unknown }>(
      `{ transactions { id } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeDefined();
    expect(errors![0].message).toContain('API "Query.transactions" is temporarily disabled');
    expect(errors![0].message).toContain("uji insiden");
    expect(errors![0].extensions?.code).toBe(503);
  });

  it("operation lain tetap hidup saat satu dimatikan", async () => {
    const { session } = await signUpUser();
    await apiKillswitchService.disableOperation("Query.transactions");

    const { data, errors } = await gql<{ setting: { currency: string } }>(
      `{ setting { currency } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.setting.currency).toBe("IDR");
  });

  it("mutation yang dimatikan juga ditolak", async () => {
    const { session } = await signUpUser();
    await apiKillswitchService.disableOperation("Mutation.updateSetting", "deployment lock");

    const { errors } = await gql(
      `mutation($input: UpdateSettingInput!) { updateSetting(input: $input) { currency } }`,
      { input: { currency: "USD" } },
      authHeaders(session),
    );

    expect(errors).toBeDefined();
    expect(errors![0].extensions?.code).toBe(503);
  });

  it("operation kembali hidup setelah di-enable", async () => {
    const { session } = await signUpUser();
    await apiKillswitchService.disableOperation("Query.setting");
    await apiKillswitchService.enableOperation("Query.setting");

    const { errors } = await gql<{ setting: { currency: string } }>(
      `{ setting { currency } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
  });
});