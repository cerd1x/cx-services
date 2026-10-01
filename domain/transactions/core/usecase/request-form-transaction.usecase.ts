import { NotFoundError } from "$services/shared/kernel/errors/service-error";
import { ID } from "$services/shared/kernel";
import { PasswordUtils } from "$services/shared/kernel/password-utils";
import { Cache } from "$services/shared/infra/cache";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class RequestFormTransactionUseCase extends CoreUsecase<string, ID> {
  static #formIdCache = new Cache<string>(300_000);

  @logMethod(logger)
  async execute(userId: ID): Promise<string> {
    const rId = Math.floor(10000 + Math.random() * 90000).toString();
    const hash = await PasswordUtils.hash(rId.toString());

    RequestFormTransactionUseCase.#formIdCache.set(userId.toHash, hash);

    return hash;
  }

  @logMethod(logger)
  validateFormTransaction(hash: string, userId: ID): void {
    const storedHash = RequestFormTransactionUseCase.#formIdCache.get(userId.toHash);

    if (!storedHash || storedHash !== hash) {
      throw new NotFoundError("hash form invalid");
    }

    RequestFormTransactionUseCase.#formIdCache.delete(userId.toHash);
  }
}