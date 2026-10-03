import { ApiKillswitchRepository } from "../ports/out/api-killswitch-repository.port";
import { operationKeySchema } from "../model/api-killswitch.model";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type EnableOperationInput = {
  operation: string;
};

export type EnableOperationResult = {
  operation: string;
  enabled: boolean;
  /** `false` bila operation memang tidak sedang dimatikan. */
  changed: boolean;
};

export class EnableOperationUseCase extends CoreUsecase<EnableOperationResult, EnableOperationInput> {
  @logMethod(logger)
  async execute(input: EnableOperationInput): Promise<EnableOperationResult> {
    const parsed = operationKeySchema.safeParse(input.operation);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const repo = this.deps.get(ApiKillswitchRepository);
    const changed = await repo.enable(parsed.data);

    if (changed) logger.warn(`API re-enabled: ${parsed.data}`);
    return { operation: parsed.data, enabled: true, changed };
  }
}