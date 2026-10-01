const defaultMaxAge = 60 * 60 * 24 * 30;

export type CookieOptions = {
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
};

export function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;

    const name = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();

    if (name) cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

export function getCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  const cookies = parseCookies(header);
  return cookies[name] ?? null;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  const maxAge = opts.maxAge ?? defaultMaxAge;
  parts.push(`Max-Age=${maxAge}`);

  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure ?? true) parts.push("Secure");
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);

  return parts.join("; ");
}

export function deleteCookie(
  name: string,
  opts: Pick<CookieOptions, "path" | "domain"> = {},
): string {
  return serializeCookie(name, "", { ...opts, maxAge: 0 });
}
