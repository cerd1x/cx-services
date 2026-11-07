import { appConfigs } from "$config";
import { constantTimeEqual } from "./password-utils";

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export class CsrfToken {
  static async sign(randBytes: Uint8Array): Promise<string> {
    const keyData = new TextEncoder().encode(appConfigs.app.secretKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const buf = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      randBytes as any as BufferSource,
    );
    const signature = new Uint8Array(buf as ArrayBuffer);
    return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  static async generate(): Promise<{ token: string; randHex: string }> {
    const randBytes = new Uint8Array(32);
    crypto.getRandomValues(randBytes);
    const token = await CsrfToken.sign(randBytes);
    const randHex = Array.from(randBytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    return { token, randHex };
  }

  static async verify(token: string, randHex: string): Promise<boolean> {
    try {
      const randBytes = hexToBuf(randHex);
      const expected = await CsrfToken.sign(randBytes);
      const tokenBytes = new TextEncoder().encode(token);
      const expectedBytes = new TextEncoder().encode(expected);
      return constantTimeEqual(tokenBytes, expectedBytes);
    } catch {
      return false;
    }
  }
}
