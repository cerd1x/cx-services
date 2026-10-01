import { CsrfToken } from "$services/shared/kernel/csrf";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type WebAuthnChallengeKind = "register" | "auth";

export type WebAuthnChallengePayload = {
  kind: WebAuthnChallengeKind;
  userId?: number;
  challenge: string;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class WebAuthnChallenge {
  static async issue(input: {
    kind: WebAuthnChallengeKind;
    challenge: string;
    userId?: number;
  }): Promise<string> {
    const payload: WebAuthnChallengePayload = {
      kind: input.kind,
      challenge: input.challenge,
      exp: Date.now() + CHALLENGE_TTL_MS,
    };
    if (input.userId !== undefined) payload.userId = input.userId;

    const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const signature = await CsrfToken.sign(base64UrlToBytes(encoded));
    return `${encoded}.${signature}`;
  }

  static async verify(
    token: string,
    expected: { kind: WebAuthnChallengeKind; userId?: number },
  ): Promise<WebAuthnChallengePayload> {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) throw new AuthenticationError("Invalid challenge token");

    const expectedSignature = await CsrfToken.sign(base64UrlToBytes(encoded));
    if (expectedSignature !== signature) throw new AuthenticationError("Invalid challenge token");

    let payload: WebAuthnChallengePayload;
    try {
      payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
    } catch {
      throw new AuthenticationError("Invalid challenge token");
    }

    if (payload.kind !== expected.kind) throw new AuthenticationError("Invalid challenge token");
    if (expected.userId !== undefined && payload.userId !== expected.userId) {
      throw new AuthenticationError("Invalid challenge token");
    }
    if (Date.now() > payload.exp) throw new AuthenticationError("Challenge expired");
    if (typeof payload.challenge !== "string" || payload.challenge.length === 0) {
      throw new AuthenticationError("Invalid challenge token");
    }

    return payload;
  }
}
