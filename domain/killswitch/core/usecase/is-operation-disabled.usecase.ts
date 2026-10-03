import { ApiKillswitchRepository } from "../ports/out/api-killswitch-repository.port";
import type { DisabledState } from "../ports/out/api-killswitch-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type IsOperationDisabledInput = {
  operation: string;
};

/**
 * Hot path: dipanggil untuk setiap root operation GraphQL.
 *
 * Sengaja tidak melempar error. Keputusan ada di transformer GraphQL,
 * sehingga use case ini murni membaca state dan mudah diuji.
 */
export class IsOperationDisabledUseCase extends CoreUsecase<
  DisabledState,
  IsOperationDisabledInput
> {
  @logMethod(logger)
  async execute(input: IsOperationDisabledInput): Promise<DisabledState> {
    const repo = this.deps.get(ApiKillswitchRepository);
    return repo.isDisabled(input.operation);
  }
}