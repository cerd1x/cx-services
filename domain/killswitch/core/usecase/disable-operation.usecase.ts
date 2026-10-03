import { ApiKillswitchRepository } from "../ports/out/api-killswitch-repository.port";
import { operationKeySchema, type ApiKillswitch } from "../model/api-killswitch.model";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type DisableOperationInput = {
  operation: string;
  reason?: string;
};

export class DisableOperationUseCase extends CoreUsecase<ApiKillswitch, DisableOperationInput> {
  @logMethod(logger)
  async execute(input: DisableOperationInput): Promise<ApiKillswitch> {
    const parsed = operationKeySchema.safeParse(input.operation);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const repo = this.deps.get(ApiKillswitchRepository);
    const result = await repo.disable(parsed.data, input.reason);

    logger.warn(`API disabled: ${result.operation}${result.reason ? ` — ${result.reason}` : ""}`);
    return result;
  }
}