import type { PasskeyService } from "$services/domain/auth";
import { PasskeyServiceCtx } from "./ctx";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export class ListPasskeysUseCase extends CoreUsecase<
  Awaited<ReturnType<PasskeyService["findByUserId"]>>,
  number
> {
  @logMethod(logger)
  async execute(userId: number) {
    const passkeyService = this.deps.get(PasskeyServiceCtx) as unknown as PasskeyService;
    return passkeyService.findByUserId(userId);
  }
}