import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type SettingDto = {
  id: string;
  userId: string;
  currency: string;
  darkMode: boolean;
  dateFormat: string;
};

describe("setting e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("returns the default settings created on sign-up", async () => {
    const { session } = await signUpUser();

    const { data, errors } = await gql<{ setting: SettingDto }>(
      `{ setting { id userId currency darkMode dateFormat } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.setting.currency).toBe("IDR");
    expect(data!.setting.darkMode).toBe(false);
    expect(data!.setting.dateFormat).toBe("d MMM yyyy, HH:mm");
    expect(data!.setting.userId).toBeTruthy();
  });

  it("updates currency and theme", async () => {
    const { session } = await signUpUser();
    const { data: before } = await gql<{ setting: SettingDto }>(
      `{ setting { currency darkMode } }`,
      undefined,
      authHeaders(session),
    );
    expect(before!.setting.currency).toBe("IDR");

    const update = await gql<{ updateSetting: SettingDto }>(
      `mutation($input: UpdateSettingInput!) {
        updateSetting(input: $input) { currency darkMode }
      }`,
      { input: { currency: "USD", darkMode: true } },
      authHeaders(session),
    );
    expect(update.errors).toBeUndefined();
    expect(update.data!.updateSetting.currency).toBe("USD");
    expect(update.data!.updateSetting.darkMode).toBe(true);

    const after = await gql<{ setting: SettingDto }>(
      `{ setting { currency darkMode } }`,
      undefined,
      authHeaders(session),
    );
    expect(after.data!.setting.currency).toBe("USD");
    expect(after.data!.setting.darkMode).toBe(true);
  });
});