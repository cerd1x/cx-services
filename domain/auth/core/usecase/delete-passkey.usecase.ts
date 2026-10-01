import type { PasskeyService } from "$services/domain/auth";
import { PasskeyServiceCtx } from "./ctx";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DeletePasskeyInput = {
  userId: number;
  credentialId: string;
};

export class DeletePasskeyUseCase extends CoreUsecase<boolean, DeletePasskeyInput> {
  @logMethod(logger)
  async execute(input: DeletePasskeyInput): Promise<boolean> {
    const passkeyService = this.deps.get(PasskeyServiceCtx) as unknown as PasskeyService;
    return passkeyService.delete(input);
  }
}