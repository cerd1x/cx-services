import { argon2idAsync } from "@noble/hashes/argon2.js";

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_LENGTH = 16;
const PBKDF2_KEY_LENGTH_BITS = 256;
const PBKDF2_PREFIX = "$pbkdf2-sha256$";

function b64decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bufToHex(buf: Uint8Array): string {
  let hex = "";
  for (const byte of buf) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function assertPassword(password: string) {
  if (!password) throw new Error("Empty password");
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" } as any,
    key,
    PBKDF2_KEY_LENGTH_BITS,
  );
  return new Uint8Array(derived);
}

async function legacyVerify(
  password: string,
  hashed: string,
): Promise<boolean> {
  const parts = hashed.split("$");
  const iterations = Number(parts[2].split("=")[1]);
  const salt = hexToBuf(parts[3]);
  const expected = hexToBuf(parts[4]);
  const derived = await pbkdf2(password, salt, iterations);
  return constantTimeEqual(new Uint8Array(derived), expected);
}

export class PasswordUtils {
  static async hash(password: string): Promise<string> {
    assertPassword(password);
    const isTest = process.env.NODE_ENV === "test";
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const t = isTest ? 1 : 3;
    const m = isTest ? 1024 : 65536;
    const derived = await argon2idAsync(password, salt, {
      t,
      m,
      p: 1,
      dkLen: 32,
      version: 0x13,
    });
    const saltB64 = btoa(String.fromCharCode(...salt));
    const derivedB64 = btoa(String.fromCharCode(...derived));
    return `$argon2id$v=19$t=${t},m=${m},p=1$${saltB64}$${derivedB64}`;
  }

  static async fastHash(token: string): Promise<string> {
    assertPassword(token);
    const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH));
    const derived = await pbkdf2(token, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bufToHex(salt)}$${bufToHex(derived)}`;
  }

  static async verify(password: string, hashed: string): Promise<boolean> {
    assertPassword(password);
    if (hashed.startsWith("$argon2id$")) {
      const parts = hashed.split("$");
      const version = Number(parts[2].split("=")[1]);
      const params = Object.fromEntries(
        parts[3].split(",").map((kv) => {
          const [k, v] = kv.split("=");
          return [k, Number(v)];
        }),
      );
      const { t, m, p } = params;
      const salt = b64decode(parts[4]);
      const expected = b64decode(parts[5]);
      const derived = await argon2idAsync(password, salt, {
        t,
        m,
        p,
        dkLen: expected.length,
        version,
      });
      return constantTimeEqual(derived, expected);
    }
    if (hashed.startsWith(PBKDF2_PREFIX)) {
      const parts = hashed.split("$");
      const iterations = Number(parts[2]);
      const salt = hexToBuf(parts[3]);
      const expected = hexToBuf(parts[4]);
      const derived = await pbkdf2(password, salt, iterations);
      return constantTimeEqual(derived, expected);
    }
    return legacyVerify(password, hashed);
  }
}
