import { afterAll, beforeAll } from "bun:test";
import { drizzle } from "drizzle-orm/d1";
import { createMockD1, initTestTables } from "../utils/d1-mock";
import { setD1, setDB } from "$services/shared/infra/db";
import { yogaFetch } from "$services/shared/infra/graphql/yoga-server";
import { appConfigs } from "$config";

let sqlite: ReturnType<typeof createMockD1>["sqlite"] | null = null;

export function e2eLifecycle(): void {
  beforeAll(() => {
    const env = createMockD1();
    sqlite = env.sqlite;
    initTestTables(sqlite);
    setDB(drizzle(env.d1 as never) as never);
    setD1(env.d1 as never);
  });

  afterAll(() => {
    sqlite?.close();
    sqlite = null;
  });
}

export type GqlError = {
  message: string;
  extensions?: Record<string, unknown>;
  path?: Array<string | number> | null;
};

export async function gql<T extends object>(
  query: string,
  variables?: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ data: T; errors?: GqlError[]; res: Response }> {
  const res = await yogaFetch(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ query, variables }),
    }),
  );
  const body: { data?: T; errors?: GqlError[] } = await res.json();
  return { data: (body.data ?? {}) as T, errors: body.errors, res };
}

/** Semua header `Set-Cookie` pada response, satu entry per cookie. */
export function setCookiesOf(res: Response): string[] {
  return res.headers.getSetCookie?.() ?? [];
}

/** Header `Set-Cookie` dengan nama tertentu, atau `undefined` jika tidak ada. */
export function findSetCookie(res: Response, name: string): string | undefined {
  return setCookiesOf(res).find((c) => c.startsWith(`${encodeURIComponent(name)}=`));
}

export function sessionCookieOf(res: Response): string | undefined {
  return findSetCookie(res, appConfigs.cookie.sessionKey);
}

export function refreshCookieOf(res: Response): string | undefined {
  return findSetCookie(res, appConfigs.cookie.refreshKey);
}

export function authHeaders(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

export async function signUpUser(username?: string): Promise<{
  session: string;
  refreshToken: string;
  user: { id: string; name: string; username: string };
  username: string;
  res: Response;
}> {
  const uname = username ?? `e2e_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const { data, errors, res } = await gql<{
    signUp: {
      session: string;
      refreshToken: string;
      user: { id: string; name: string; username: string };
    };
  }>(
    `mutation($input: SignUpInput!) {
      signUp(input: $input) {
        session
        refreshToken
        user { id name username }
      }
    }`,
    { input: { name: "E2E User", username: uname, password: "password123" } },
  );
  if (errors?.length) throw new Error(`signUp failed: ${errors[0].message}`);
  return { ...data!.signUp, username: uname, res };
}
