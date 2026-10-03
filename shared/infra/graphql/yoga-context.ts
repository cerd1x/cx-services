import type { YogaInitialContext } from "graphql-yoga";
import {
  userService,
  authService,
  assetService,
  contactService,
  productService,
  transactionService,
  settingService,
  statisticService,
  orderService,
  paymentService,
  apiKillswitchService,
} from "$services/composition/root.container";
import { ID } from "$services/shared/kernel/id";
import { appConfigs } from "$config";

export type CookieSetter = {
  set: (opts: {
    value: string;
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
  }) => void;
};

/**
 * Kumpulan string `Set-Cookie` untuk satu request.
 *
 * Dibuat oleh pemanggil `yoga.fetch()` lalu diteruskan sebagai serverContext,
 * karena `createContext` hanya bisa menulis cookie dan tidak bisa menyentuh
 * `Response`. Setelah `yoga.fetch()` selesai, array ini ditulis ke header
 * response lewat `withSetCookies()`.
 */
export type CookieJar = string[];

export type YogaContext = YogaInitialContext & {
  user: typeof userService;
  auth: typeof authService;
  asset: typeof assetService;
  contact: typeof contactService;
  product: typeof productService;
  transaction: typeof transactionService;
  setting: typeof settingService;
  statistic: typeof statisticService;
  order: typeof orderService;
  payment: typeof paymentService;
  killswitch: typeof apiKillswitchService;
  headers: Record<string, string | undefined>;
  userAuth: { id: ID; username: string } | null;
  cookies: Record<string, string>;
  cookie: Record<string, CookieSetter>;
};

function parseCookiesFromHeader(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export async function createContext(
  base: YogaInitialContext & { cookie?: Record<string, CookieSetter>; cookieJar?: CookieJar },
): Promise<YogaContext> {
  const cookies = parseCookiesFromHeader(base.request.headers.get("Cookie"));

  /**
   * Yoga tidak menyediakan `context.cookie` di jalur fetch (`@whatwg-node/server`
   * tidak eagerly-parse cookie), jadi cookie yang di-set resolver harus datang
   * dari `makeCookieSetter` yang lazy. Fallback `{}` membuat
   * `cookie[key].set()` meledak dengan "Cannot read properties of undefined".
   */
  const cookie = base.cookie ?? makeCookieSetter(base.cookieJar ?? []);

  let token = cookies[appConfigs.cookie.sessionKey];

  if (!token) {
    const authHeader = base.request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  let userAuth: { id: ID; username: string } | null = null;

  if (token) {
    try {
      const result = await authService.authorize(token);
      const { user } = result;

      if (result.token?.session) {
        cookie[appConfigs.cookie.sessionKey]?.set({ value: result.token.session });
      }

      if (user.id) {
        userAuth = { id: user.id, username: user.username };
      }
    } catch {
      userAuth = null;
      cookie[appConfigs.cookie.sessionKey]?.set({ value: "", maxAge: 0, path: "/" });
    }
  }

  return {
    ...base,
    user: userService,
    auth: authService,
    asset: assetService,
    contact: contactService,
    product: productService,
    transaction: transactionService,
    setting: settingService,
    statistic: statisticService,
    order: orderService,
    payment: paymentService,
    killswitch: apiKillswitchService,
    headers: {},
    userAuth,
    cookies,
    cookie,
  } as YogaContext;
}

/**
 * Tambahkan isi `CookieJar` sebagai header `Set-Cookie` pada response.
 *
 * Header dibangun ulang karena `Headers` iterator menggabungkan multi-value
 * `Set-Cookie` menjadi satu string yang dipisah koma, yang tidak bisa dibaca
 * browser. `Response` yang dikembalikan yoga tidak bisa di-mutasi langsung
 * karena `Set-Cookie` termasuk forbidden response-header name pada guard
 * `"response"` — menambahkannya lewat `new Headers()` (guard `"none"`) dulu
 * baru di-wrap ke `Response` baru.
 */
export function withSetCookies(response: Response, jar: CookieJar): Response {
  if (jar.length === 0) return response;

  const headers = new Headers();
  const existing = response.headers.getSetCookie?.() ?? [];

  for (const [name, value] of response.headers) {
    if (name.toLowerCase() === "set-cookie") continue;
    headers.append(name, value);
  }
  for (const cookie of existing) headers.append("Set-Cookie", cookie);
  for (const cookie of jar) headers.append("Set-Cookie", cookie);

  const bodyless =
    response.status === 101 ||
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304;

  return new Response(bodyless ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function makeCookieSetter(cookies: string[]): Record<string, CookieSetter> {
  const proxy: Record<string, CookieSetter> = {};
  const defaults = {
    httpOnly: appConfigs.cookie.httpOnly,
    secure: appConfigs.cookie.secure,
    sameSite: appConfigs.cookie.sameSite,
    path: appConfigs.cookie.path,
  };
  const setCookie = (
    name: string,
    opts: {
      value: string;
      maxAge?: number;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "strict" | "lax" | "none";
    },
  ) => {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(opts.value)}`;
    const path = opts.path ?? defaults.path;
    const httpOnly = opts.httpOnly ?? defaults.httpOnly;
    const secure = opts.secure ?? defaults.secure;
    const sameSite = opts.sameSite ?? defaults.sameSite;
    if (path) cookie += `; Path=${path}`;
    if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`;
    if (httpOnly) cookie += `; HttpOnly`;
    if (secure) cookie += `; Secure`;
    if (sameSite) cookie += `; SameSite=${sameSite}`;
    cookies.push(cookie);
  };
  return new Proxy(proxy, {
    get(_target, name: string) {
      if (!proxy[name]) {
        proxy[name] = { set: (opts) => setCookie(name, opts) };
      }
      return proxy[name];
    },
  });
}
