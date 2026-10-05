/**
 * `Token` — value object JWT untuk session & refresh.
 *
 * **Implementasi: `jsonwebtoken`.**
 *
 * Hanya untuk runtime Node/Bun (`server.ts`, unit test). **Jangan dipakai di
 * Cloudflare Workers**: paket ini hard-depend pada `crypto.KeyObject`, sedangkan
 * `scripts/build.ts` memakai `target: "browser"` sehingga Bun meng-inline
 * polyfill `node:crypto` ke bundle. Polyfill tersebut tidak meng-export
 * `KeyObject`, dan `jsonwebtoken/sign.js` memanggil
 * `secretOrPrivateKey instanceof KeyObject` → `TypeError: Right-hand side of
 * 'instanceof' is not an object`.
 *
 * Untuk Cloudflare Workers, lihat `./token.vo.jose`.
 */
import { z } from "zod";
import { appConfigs } from "$config";
import { UnauthorizedError } from "$services/shared/kernel/errors/service-error";
import jwt from "jsonwebtoken";

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

  async generate(): Promise<string> {
    let data = {
      userId: this.#userId,
      expiresAt: new Date(this.#expiresAt),
      type: this.#type,
    };

    const payload = tokenSchema.parse(data);

    return jwt.sign(payload, appConfigs.app.secretKey);
  }

  async verify(token: string): Promise<DecodedToken> {
    try {
      const payload = jwt.verify(token, appConfigs.app.secretKey) as {
        userId: number;
        type: TokenType;
        expiresAt: string;
        username: string;
      };

      return {
        userId: payload.userId,
        type: payload.type,
        expiresAt: new Date(payload.expiresAt),
        username: payload.username,
      };
    } catch {
      throw new Error("invalid token");
    }
  }

  decode(token: string): TokenPayload | null {
    const payload = jwt.decode(token) as {
      userId: number;
      type: TokenType;
      expiresAt: string;
      username: string;
    };

    if (!payload) return null;

    return {
      userId: payload.userId,
      type: payload.type,
      expiresAt: new Date(payload.expiresAt),
    };
  }

  static async from(token: string): Promise<Token> {
    if (token.length === 0) throw new UnauthorizedError("Your token is empty");

    try {
      const decoded = jwt.verify(token, appConfigs.app.secretKey) as {
        userId: number;
        type: TokenType;
        expiresAt: string;
        username: string;
      };

      const payload: TokenPayload = {
        userId: decoded.userId,
        type: decoded.type,
        expiresAt: new Date(decoded.expiresAt),
      };

      const result = tokenSchema.safeParse(payload);
      if (!result.success) throw new Error("invalid token");

      return new Token(result.data);
    } catch {
      throw new Error("invalid token");
    }
  }
}
