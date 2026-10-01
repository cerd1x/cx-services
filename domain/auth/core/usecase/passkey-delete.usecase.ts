import { PasskeyRepository } from "../ports/out/passkey-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type PasskeyDeleteInput = {
  userId: number;
  credentialId: string;
};

export class PasskeyDeleteUseCase extends CoreUsecase<boolean, PasskeyDeleteInput> {
  @logMethod(logger)
  async execute(input: PasskeyDeleteInput): Promise<boolean> {
    const repo = this.deps.get(PasskeyRepository);
    return repo.deleteByCredentialId(input.userId, input.credentialId);
  }
}