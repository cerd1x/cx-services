import type { ApiKillswitch } from "./core/model/api-killswitch.model";
import type { DisabledState } from "./core/ports/out/api-killswitch-repository.port";
import { DisableOperationUseCase } from "./core/usecase/disable-operation.usecase";
import { EnableOperationUseCase } from "./core/usecase/enable-operation.usecase";
import type { EnableOperationResult } from "./core/usecase/enable-operation.usecase";
import { IsOperationDisabledUseCase } from "./core/usecase/is-operation-disabled.usecase";
import { ListDisabledOperationsUseCase } from "./core/usecase/list-disabled-operations.usecase";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ServiceContainer } from "$services/shared/base";
import { ApiKillswitchRepositoryImpl } from "./adapters/driven/drizzle/api-killswitch.repository";
import { ApiKillswitchRepository } from "./core/ports/out/api-killswitch-repository.port";

export class ApiKillswitchService {
  static #instance: ApiKillswitchService;
  #isOperationDisabled: IsOperationDisabledUseCase;
  #disableOperation: DisableOperationUseCase;
  #enableOperation: EnableOperationUseCase;
  #listDisabledOperations: ListDisabledOperationsUseCase;

  @logMethod(logger)
  static init(
    isOperationDisabled: IsOperationDisabledUseCase,
    disableOperation: DisableOperationUseCase,
    enableOperation: EnableOperationUseCase,
    listDisabledOperations: ListDisabledOperationsUseCase,
  ): ApiKillswitchService {
    ApiKillswitchService.#instance = new ApiKillswitchService(
      isOperationDisabled,
      disableOperation,
      enableOperation,
      listDisabledOperations,
    );
    return ApiKillswitchService.#instance;
  }

  @logMethod(logger)
  static getInstance(): ApiKillswitchService {
    if (!ApiKillswitchService.#instance) {
      throw new Error("ApiKillswitchService not initialized");
    }
    return ApiKillswitchService.#instance;
  }

  private constructor(
    isOperationDisabled: IsOperationDisabledUseCase,
    disableOperation: DisableOperationUseCase,
    enableOperation: EnableOperationUseCase,
    listDisabledOperations: ListDisabledOperationsUseCase,
  ) {
    this.#isOperationDisabled = isOperationDisabled;
    this.#disableOperation = disableOperation;
    this.#enableOperation = enableOperation;
    this.#listDisabledOperations = listDisabledOperations;
  }

  @logMethod(logger)
  async isOperationDisabled(operation: string): Promise<DisabledState> {
    return this.#isOperationDisabled.execute({ operation });
  }

  @logMethod(logger)
  async disableOperation(operation: string, reason?: string): Promise<ApiKillswitch> {
    return this.#disableOperation.execute({ operation, reason });
  }

  @logMethod(logger)
  async enableOperation(operation: string): Promise<EnableOperationResult> {
    return this.#enableOperation.execute({ operation });
  }

  @logMethod(logger)
  async listDisabledOperations(): Promise<ApiKillswitch[]> {
    return this.#listDisabledOperations.execute();
  }
}

export type ApiKillswitchAdapters = {
  killswitchRepo: ApiKillswitchRepository;
};

export function createApiKillswitchService({
  killswitchRepo,
}: ApiKillswitchAdapters): ApiKillswitchService {
  const container = new ServiceContainer().set(ApiKillswitchRepository, killswitchRepo);

  const isOperationDisabled = new IsOperationDisabledUseCase().setContext(container);
  const disableOperation = new DisableOperationUseCase().setContext(container);
  const enableOperation = new EnableOperationUseCase().setContext(container);
  const listDisabledOperations = new ListDisabledOperationsUseCase().setContext(container);

  container.set(IsOperationDisabledUseCase, isOperationDisabled);

  return ApiKillswitchService.init(
    isOperationDisabled,
    disableOperation,
    enableOperation,
    listDisabledOperations,
  );
}

logger.info("Initializing ApiKillswitchService...");
export const apiKillswitchService = createApiKillswitchService({
  killswitchRepo: new ApiKillswitchRepositoryImpl(),
});
logger.info("ApiKillswitchService initialized");