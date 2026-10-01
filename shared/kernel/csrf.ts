import { appConfigs } from "$config";

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
    const buf = await crypto.subtle.sign("HMAC", cryptoKey, randBytes as any as BufferSource);
    const signature = new Uint8Array(buf as ArrayBuffer);
    return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  static async generate(): Promise<{ token: string; randHex: string }> {
    const randBytes = new Uint8Array(32);
    crypto.getRandomValues(randBytes);
    const token = await CsrfToken.sign(randBytes);
    const randHex = Array.from(randBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return { token, randHex };
  }
}
