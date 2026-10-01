import { PasskeyRepository } from "../ports/out/passkey-repository.port";
import type { PasskeyRecord } from "../ports/out/passkey-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class PasskeyFindByUserIdUseCase extends CoreUsecase<PasskeyRecord[], number> {
  @logMethod(logger)
  async execute(userId: number): Promise<PasskeyRecord[]> {
    const repo = this.deps.get(PasskeyRepository);
    return repo.findByUserId(userId);
  }
}