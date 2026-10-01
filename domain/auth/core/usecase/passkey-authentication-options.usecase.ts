import type { PasskeyService } from "$services/domain/auth";
import { PasskeyServiceCtx } from "./ctx";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type PasskeyAuthenticationOptionsInput = {
  rpID: string;
};

export class PasskeyAuthenticationOptionsUseCase extends CoreUsecase<
  Awaited<ReturnType<PasskeyService["generateAuthenticationOptions"]>>,
  PasskeyAuthenticationOptionsInput
> {
  @logMethod(logger)
  async execute(input: PasskeyAuthenticationOptionsInput) {
    const passkeyService = this.deps.get(PasskeyServiceCtx) as unknown as PasskeyService;
    return passkeyService.generateAuthenticationOptions(input);
  }
}