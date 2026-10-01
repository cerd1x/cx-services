import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { ID } from "$services/shared/kernel";
import { Cache } from "$services/shared/infra/cache";
import { CsrfToken } from "$services/shared/kernel/csrf";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ValidateCSRFTokenInput = {
  token: string;
  userId: ID;
};

export class ValidateCSRFTokenUseCase extends CoreUsecase<void, ValidateCSRFTokenInput> {
  static #csrfCache = new Cache<{ userId: string; randHex: string }>(300_000);

  @logMethod(logger)
  static safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aBuf = Uint8Array.from(a, (c) => c.charCodeAt(0));
    const bBuf = Uint8Array.from(b, (c) => c.charCodeAt(0));
    let diff = 0;
    for (let i = 0; i < aBuf.length; i++) {
      diff |= aBuf[i] ^ bBuf[i];
    }
    return diff === 0;
  }

  @logMethod(logger)
  async execute(input: ValidateCSRFTokenInput): Promise<void> {
    const { token, userId } = input;
    const stored = ValidateCSRFTokenUseCase.#csrfCache.get(token);

    if (!stored) {
      throw new NotFoundError("CSRF token invalid or expired");
    }

    if (stored.userId !== userId.toHash) {
      throw new NotFoundError("CSRF token does not belong to this user");
    }

    const randBytes = Uint8Array.from(stored.randHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const recomputed = await CsrfToken.sign(randBytes);

    if (!ValidateCSRFTokenUseCase.safeEqual(recomputed, token)) {
      throw new NotFoundError("CSRF token verification failed");
    }

    ValidateCSRFTokenUseCase.#csrfCache.delete(token);
  }

  @logMethod(logger)
  async requestFormCSRFToken(userId: ID): Promise<string> {
    const { token, randHex } = await CsrfToken.generate();

    ValidateCSRFTokenUseCase.#csrfCache.set(token, { userId: userId.toHash, randHex });

    return token;
  }
}