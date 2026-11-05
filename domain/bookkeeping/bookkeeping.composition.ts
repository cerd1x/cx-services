import { ServiceContainer } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { BookkeepingSourceAdapter } from "./adapters/driven/services/bookkeeping-source.adapter";
import { BookkeepingFailedPayments, BookkeepingLedger } from "./core/model/bookkeeping.model";
import { BookkeepingSource } from "./core/ports/out/bookkeeping-source.port";
import {
  GetBookkeepingFailedPaymentsUseCase,
  type GetBookkeepingFailedPaymentsInput,
} from "./core/usecase/get_bookkeeping_failed_payments.usecase";
import {
  GetBookkeepingLedgerUseCase,
  type GetBookkeepingLedgerInput,
} from "./core/usecase/get_bookkeeping_ledger.usecase";
import { logger } from "./core/value-objects/logger";

export type BookkeepingAdapters = {
  source: BookkeepingSource;
};

export class BookkeepingService {
  static #instanceBookkeepingService: BookkeepingService;
  #getLedger: GetBookkeepingLedgerUseCase;
  #getFailedPayments: GetBookkeepingFailedPaymentsUseCase;

  @logMethod(logger)
  static init(
    getLedger: GetBookkeepingLedgerUseCase,
    getFailedPayments: GetBookkeepingFailedPaymentsUseCase,
  ): BookkeepingService {
    BookkeepingService.#instanceBookkeepingService = new BookkeepingService(
      getLedger,
      getFailedPayments,
    );
    return BookkeepingService.#instanceBookkeepingService;
  }

  @logMethod(logger)
  static getInstance(): BookkeepingService {
    if (!BookkeepingService.#instanceBookkeepingService) {
      throw new Error("BookkeepingService not initialized");
    }
    return BookkeepingService.#instanceBookkeepingService;
  }

  private constructor(
    getLedger: GetBookkeepingLedgerUseCase,
    getFailedPayments: GetBookkeepingFailedPaymentsUseCase,
  ) {
    this.#getLedger = getLedger;
    this.#getFailedPayments = getFailedPayments;
  }

  @logMethod(logger)
  async getLedger(input: GetBookkeepingLedgerInput): Promise<BookkeepingLedger> {
    return this.#getLedger.execute(input);
  }

  @logMethod(logger)
  async getFailedPayments(
    input: GetBookkeepingFailedPaymentsInput,
  ): Promise<BookkeepingFailedPayments> {
    return this.#getFailedPayments.execute(input);
  }
}

export function createBookkeepingService({ source }: BookkeepingAdapters): BookkeepingService {
  const container = new ServiceContainer().set(BookkeepingSource, source);

  return BookkeepingService.init(
    new GetBookkeepingLedgerUseCase().setContext(container),
    new GetBookkeepingFailedPaymentsUseCase().setContext(container),
  );
}

logger.info("Initializing BookkeepingService...");
export const bookkeepingService = createBookkeepingService({
  source: new BookkeepingSourceAdapter(),
});
logger.info("BookkeepingService initialized");
