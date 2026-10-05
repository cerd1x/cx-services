import { describe, expect, it } from "bun:test";
import {
  authHeaders,
  e2eLifecycle,
  gql,
  refreshCookieOf,
  sessionCookieOf,
  setCookiesOf,
  signUpUser,
} from "./_helper";
import { appConfigs } from "$config";

describe("auth e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("signUp returns session + refreshToken", async () => {
    const result = await signUpUser();
    expect(result.session.length).toBeGreaterThan(0);
    expect(result.refreshToken.length).toBeGreaterThan(0);
    expect(result.user.name).toBe("E2E User");
    expect(result.user.username).toBe(result.username);
    expect(result.user.id).toBeTruthy();
  });

  it("signIn returns a new session", async () => {
    const username = `signin_${Date.now()}`;
    await signUpUser(username);

    const { data, errors } = await gql<{
      signIn: { session: string; user: { username: string } };
    }>(
      `mutation($input: SignInInput!) {
        signIn(input: $input) { session user { username } }
      }`,
      { input: { username, password: "password123" } },
    );

    expect(errors).toBeUndefined();
    expect(data!.signIn.session.length).toBeGreaterThan(0);
    expect(data!.signIn.user.username).toBe(username);
  });

  it("me returns the authenticated user", async () => {
    const { session } = await signUpUser();

    const { data, errors } = await gql<{ me: { id: string; name: string; username: string } }>(
      `{ me { id name username } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.me.name).toBe("E2E User");
    expect(data!.me.id).toBeTruthy();
  });

  it("checkAuthorized is true with token and false without", async () => {
    const { session } = await signUpUser();

    const withToken = await gql<{ checkAuthorized: boolean }>(
      `{ checkAuthorized }`,
      undefined,
      authHeaders(session),
    );
    expect(withToken.data!.checkAuthorized).toBe(true);

    const withoutToken = await gql<{ checkAuthorized: boolean }>(`{ checkAuthorized }`);
    expect(withoutToken.data!.checkAuthorized).toBe(false);
  });

  it("rejects authorized query without a token", async () => {
    const { data, errors } = await gql<{ me: unknown }>(`{ me { id name } }`);

    expect(data.me).toBeUndefined();
    expect(errors).toBeDefined();
    expect(Array.isArray(errors) && errors.length).toBeGreaterThan(0);
  });

  it("signUp sets session + refresh cookie on the response", async () => {
    const { res } = await signUpUser();

    const session = sessionCookieOf(res);
    const refresh = refreshCookieOf(res);

    expect(session).toBeDefined();
    expect(refresh).toBeDefined();
    expect(session).toContain("HttpOnly");
    expect(session).toContain(`Max-Age=${appConfigs.cookie.sessionMaxAge}`);
    expect(refresh).toContain(`Max-Age=${appConfigs.cookie.refreshMaxAge}`);
    // Dua cookie harus terpisah entry, bukan digabung string berkoma.
    expect(
      setCookiesOf(res).filter((c) =>
        c.startsWith(`${encodeURIComponent(appConfigs.cookie.sessionKey)}=`),
      ),
    ).toHaveLength(1);
  });

  it("signIn sets session + refresh cookie on the response", async () => {
    const username = `cookie_signin_${Date.now()}`;
    await signUpUser(username);

    const { data, errors, res } = await gql<{
      signIn: { session: string; user: { username: string } };
    }>(
      `mutation($input: SignInInput!) {
        signIn(input: $input) { session user { username } }
      }`,
      { input: { username, password: "password123" } },
    );

    expect(errors).toBeUndefined();
    expect(data!.signIn.user.username).toBe(username);
    expect(sessionCookieOf(res)).toBeDefined();
    expect(refreshCookieOf(res)).toBeDefined();
  });

  it("signOut sends cookies with Max-Age=0 to clear them", async () => {
    const { session } = await signUpUser();

    const out = await gql<{ signOut: boolean }>(`mutation { signOut }`, undefined, {
      cookie: `${encodeURIComponent(appConfigs.cookie.sessionKey)}=${session}`,
    });

    expect(out.errors).toBeUndefined();
    expect(out.data!.signOut).toBe(true);
    expect(sessionCookieOf(out.res)).toContain("Max-Age=0");
    expect(refreshCookieOf(out.res)).toContain("Max-Age=0");
  });

  it("signOut invalidates the session", async () => {
    const { session, username } = await signUpUser();
    const before = await gql<{ me: { username: string } }>(
      `{ me { username } }`,
      undefined,
      authHeaders(session),
    );
    expect(before.data!.me.username).toBe(username);

    const out = await gql<{ signOut: boolean }>(`mutation { signOut }`, undefined, {
      cookie: `__sst__=${session}`,
    });
    expect(out.errors).toBeUndefined();
    expect(out.data!.signOut).toBe(true);

    const after = await gql<{ me: { username: string } }>(
      `{ me { username } }`,
      undefined,
      authHeaders(session),
    );
    expect(after.data.me).toBeUndefined();
    expect(after.errors).toBeDefined();
  });
});
