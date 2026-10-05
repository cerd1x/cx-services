/**
 * `Token` — value object JWT untuk session & refresh.
 *
 * **Implementasi: `jose` (Web Crypto API).**
 *
 * Dipakai untuk Cloudflare Workers. `jose` murni `crypto.subtle`, jadi tidak
 * pernah menyentuh `node:crypto` — penting karena `scripts/build.ts` memakai
 * `target: "browser"`, dan Bun meng-inline polyfill `node:crypto` ke bundle
 * saat target tersebut dipakai. Polyfill itu tidak meng-export `KeyObject`,
 * sehingga paket Node-only seperti `jsonwebtoken` meledak dengan
 * `TypeError: Right-hand side of 'instanceof' is not an object`.
 *
 * Untuk runtime Node/Bun (tanpa Workers), lihat `./token.vo.jwt`.
 */
import { z } from "zod";
import { appConfigs } from "$config";
import { UnauthorizedError } from "$services/shared/kernel/errors/service-error";
import { SignJWT, decodeJwt, jwtVerify } from "jose";

export const tokenSchema = z.object({
  userId: z.number().positive("userId must be a positive number"),
  expiresAt: z.date(),
  type: z.enum(["session", "refresh"]).default("session"),
});

export type TokenInput = z.input<typeof tokenSchema>;
export type TokenPayload = z.output<typeof tokenSchema>;
export type TokenData = TokenPayload;
export type TokenType = "session" | "refresh";

export type DecodedToken = {
  userId: number;
  type: TokenType;
  expiresAt: Date;
  username: string;
};

const ALG = "HS256" as const;

function getKey(): Uint8Array {
  return new TextEncoder().encode(appConfigs.app.secretKey);
}

export class Token {
  static defaultExpireAt = 24 * 60 * 60 * 1000;
  #userId: number;
  #expiresAt: Date;
  #type: TokenType;

  private constructor(data: TokenPayload) {
    this.#userId = data.userId;
    this.#expiresAt = data.expiresAt;
    this.#type = data.type;
  }

  setType(type: TokenType): Token {
    this.#type = type;
    return this;
  }

  setExpireAt(expire: number): Token {
    this.#expiresAt = new Date(expire);
    return this;
  }

  get userId(): number {
    return this.#userId;
  }

  get expiresAt(): Date {
    return this.#expiresAt;
  }

  get type(): TokenType {
    return this.#type;
  }

  static setDefaultExpireAt(ms: number): void {
    Token.defaultExpireAt = ms;
  }

  get metadata(): TokenPayload {
    return {
      userId: this.#userId,
      expiresAt: this.#expiresAt,
      type: this.#type,
    } satisfies TokenPayload;
  }

  static create(
    input: Omit<TokenInput, "expiresAt" | "username"> & { expiresAt?: Date; username?: string },
  ): Token {
    const data = {
      ...input,
      expiresAt: input.expiresAt ?? new Date(Date.now() + Token.defaultExpireAt),
      username: input.username ?? "",
    };

    if (data.expiresAt <= new Date()) {
      throw new Error("expiresAt must be in the future");
    }

    const result = tokenSchema.safeParse(data);

    if (!result.success) {
      throw new Error(result.error.issues.map((i) => i.message).join(", "));
    }
    return new Token(result.data);
  }

  isExpired(): boolean {
    return Date.now() >= this.#expiresAt.getTime();
  }

  /**
   * `exp` sengaja tidak di-set: expiry ditegakkan lewat kolom D1
   * (`expired_at_session` / `expired_at_refresh`) dan `isExpired()`, sama
   * seperti perilaku `jsonwebtoken` tanpa opsi `expiresIn`.
   */
  async generate(): Promise<string> {
    return new SignJWT({
      userId: this.#userId,
      type: this.#type,
      expiresAt: this.#expiresAt.toISOString(),
    })
      .setProtectedHeader({ alg: ALG })
      .setIssuedAt()
      .sign(getKey());
  }

  async verify(token: string): Promise<DecodedToken> {
    try {
      const { payload } = await jwtVerify(token, getKey(), { algorithms: [ALG] });
      return {
        userId: payload.userId as number,
        type: payload.type as TokenType,
        expiresAt: new Date(payload.expiresAt as string),
        username: typeof payload.username === "string" ? payload.username : "",
      };
    } catch {
      throw new Error("invalid token");
    }
  }

  decode(token: string): TokenPayload | null {
    try {
      const payload = decodeJwt(token);
      return {
        userId: payload.userId as number,
        type: payload.type as TokenType,
        expiresAt: new Date(payload.expiresAt as string),
      };
    } catch {
      return null;
    }
  }

  static async from(token: string): Promise<Token> {
    if (token.length === 0) throw new UnauthorizedError("Your token is empty");

    try {
      const { payload } = await jwtVerify(token, getKey(), { algorithms: [ALG] });

      const result = tokenSchema.safeParse({
        userId: payload.userId,
        type: payload.type,
        expiresAt: new Date(payload.expiresAt as string),
      });
      if (!result.success) throw new Error("invalid token");

      return new Token(result.data);
    } catch {
      throw new Error("invalid token");
    }
  }
}
