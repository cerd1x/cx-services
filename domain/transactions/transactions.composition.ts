import {
  Transaction as TransactionType,
  type TransactionUpdateData,
} from "./core/model/transaction.model";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ID } from "$services/shared/kernel";
import {
  CreateTransactionUseCase,
  type TransactionInput,
} from "./core/usecase/create-transaction.usecase";
import { TransactionByIdUseCase } from "./core/usecase/transaction-by-id.usecase";
import { ListTransactionsUseCase } from "./core/usecase/list-transactions.usecase";
import { ListTransactionsPageUseCase } from "./core/usecase/list-transactions-page.usecase";
import { TransactionsByTypeUseCase } from "./core/usecase/transactions-by-type.usecase";
import { TransactionsByDateRangeUseCase } from "./core/usecase/transactions-by-date-range.usecase";
import { SwapBalanceUseCase } from "./core/usecase/swap-balance.usecase";
import { UpdateTransactionUseCase } from "./core/usecase/update-transaction.usecase";
import { DeleteTransactionUseCase } from "./core/usecase/delete-transaction.usecase";
import { RequestFormTransactionUseCase } from "./core/usecase/request-form-transaction.usecase";
import { ValidateCSRFTokenUseCase } from "./core/usecase/validate-csrf-token.usecase";
import type { AssetSwapGateway, SwapBalanceResult } from "./core/ports/out/asset-swap-gateway.port";
import { ServiceContainer } from "$services/shared/base";
import { EventBus } from "$services/shared/kernel/outbox/event-bus";
import { AssetService, Balance } from "$services/domain/assets";
import { TransactionRepositoryImpl } from "./adapters/driven/drizzle/transaction.repository";
import { TransactionRepository } from "./core/ports/out/transaction-repository.port";
import { AssetSwapGatewayCtx } from "./core/usecase/asset-swap-gateway.ctx";
import type { PageRequest, TransactionPage } from "./core/model/transaction-page.model";

export type { SwapBalanceResult, AssetSwapGateway } from "./core/ports/out/asset-swap-gateway.port";
export class TransactionService {
  static #instanceTransactionService: TransactionService;
  #createTransaction: CreateTransactionUseCase;
  #transactionById: TransactionByIdUseCase;
  #listTransactions: ListTransactionsUseCase;
  #listTransactionsPage: ListTransactionsPageUseCase;
  #transactionsByType: TransactionsByTypeUseCase;
  #transactionsByDateRange: TransactionsByDateRangeUseCase;
  #swapBalance: SwapBalanceUseCase;
  #updateTransaction: UpdateTransactionUseCase;
  #deleteTransaction: DeleteTransactionUseCase;
  #requestFormTransaction: RequestFormTransactionUseCase;
  #validateCSRFToken: ValidateCSRFTokenUseCase;

  @logMethod(logger)
  static init(
    createTransaction: CreateTransactionUseCase,
    transactionById: TransactionByIdUseCase,
    listTransactions: ListTransactionsUseCase,
    listTransactionsPage: ListTransactionsPageUseCase,
    transactionsByType: TransactionsByTypeUseCase,
    transactionsByDateRange: TransactionsByDateRangeUseCase,
    swapBalance: SwapBalanceUseCase,
    updateTransaction: UpdateTransactionUseCase,
    deleteTransaction: DeleteTransactionUseCase,
    requestFormTransaction: RequestFormTransactionUseCase,
    validateCSRFToken: ValidateCSRFTokenUseCase,
  ): TransactionService {
    TransactionService.#instanceTransactionService = new TransactionService(
      createTransaction,
      transactionById,
      listTransactions,
      listTransactionsPage,
      transactionsByType,
      transactionsByDateRange,
      swapBalance,
      updateTransaction,
      deleteTransaction,
      requestFormTransaction,
      validateCSRFToken,
    );
    return TransactionService.#instanceTransactionService;
  }

  @logMethod(logger)
  static getInstance(): TransactionService {
    if (!TransactionService.#instanceTransactionService) {
      throw new Error("TransactionService not initialized");
    }
    return TransactionService.#instanceTransactionService;
  }

  private constructor(
    createTransaction: CreateTransactionUseCase,
    transactionById: TransactionByIdUseCase,
    listTransactions: ListTransactionsUseCase,
    listTransactionsPage: ListTransactionsPageUseCase,
    transactionsByType: TransactionsByTypeUseCase,
    transactionsByDateRange: TransactionsByDateRangeUseCase,
    swapBalance: SwapBalanceUseCase,
    updateTransaction: UpdateTransactionUseCase,
    deleteTransaction: DeleteTransactionUseCase,
    requestFormTransaction: RequestFormTransactionUseCase,
    validateCSRFToken: ValidateCSRFTokenUseCase,
  ) {
    this.#createTransaction = createTransaction;
    this.#transactionById = transactionById;
    this.#listTransactions = listTransactions;
    this.#listTransactionsPage = listTransactionsPage;
    this.#transactionsByType = transactionsByType;
    this.#transactionsByDateRange = transactionsByDateRange;
    this.#swapBalance = swapBalance;
    this.#updateTransaction = updateTransaction;
    this.#deleteTransaction = deleteTransaction;
    this.#requestFormTransaction = requestFormTransaction;
    this.#validateCSRFToken = validateCSRFToken;
  }

  @logMethod(logger)
  async createTransaction(input: TransactionInput): Promise<TransactionType> {
    return this.#createTransaction.execute(input);
  }

  @logMethod(logger)
  async transaction(id: ID, userId: ID): Promise<TransactionType> {
    return this.#transactionById.execute({ id, userId });
  }

  @logMethod(logger)
  async transactions(userId: ID): Promise<TransactionType[]> {
    return this.#listTransactions.execute(userId);
  }

  @logMethod(logger)
  async transactionsPage(userId: ID, page: PageRequest = {}): Promise<TransactionPage> {
    return this.#listTransactionsPage.execute({ userId, ...page });
  }

  @logMethod(logger)
  async transactionsByType(type: string, userId: ID): Promise<TransactionType[]> {
    return this.#transactionsByType.execute({ type, userId });
  }

  async transactionsByDateRange(start: Date, end: Date, userId: ID): Promise<TransactionType[]> {
    return this.#transactionsByDateRange.execute({ start, end, userId });
  }

  @logMethod(logger)
  async swapBalance(
    userId: ID,
    fromAssetId: ID,
    toAssetId: ID,
    amount: string,
  ): Promise<SwapBalanceResult> {
    return this.#swapBalance.execute({ userId, fromAssetId, toAssetId, amount });
  }

  @logMethod(logger)
  async updateTransaction(
    id: ID,
    data: TransactionUpdateData,
    userId: ID,
  ): Promise<TransactionType> {
    return this.#updateTransaction.execute({ id, data, userId });
  }

  @logMethod(logger)
  async deleteTransaction(id: ID, userId: ID): Promise<void> {
    return this.#deleteTransaction.execute({ id, userId });
  }

  async requestFormTransaction(userId: ID): Promise<string> {
    return this.#requestFormTransaction.execute(userId);
  }

  async validateCSRFToken(token: string, userId: ID): Promise<void> {
    return this.#validateCSRFToken.execute({ token, userId });
  }

  async requestFormCSRFToken(userId: ID): Promise<string> {
    return this.#validateCSRFToken.requestFormCSRFToken(userId);
  }
}

export type TransactionAdapters = {
  txRepo: TransactionRepository;
  assetGateway: AssetSwapGateway;
};

/**
 * Resolvelate: assets & transactions saling memakai service satu sama lain
 * (use case assets memanggil TransactionService), jadi gateway tidak boleh
 * menangkap `assetService` saat module dievaluasi. Exemplar diambil saat request
 * terjadi supaya composition bisa di-re-init dengan adapter lain (mis. test).
 */
class LazyAssetSwapGateway implements AssetSwapGateway {
  mutateSwapAsset(userId: ID, fromAssetId: ID, toAssetId: ID, amount: string) {
    return AssetService.getInstance().mutateSwapAsset(userId, fromAssetId, toAssetId, amount);
  }
}

export function createTransactionService({
  txRepo,
  assetGateway,
}: TransactionAdapters): TransactionService {
  const container = new ServiceContainer()
    .set(TransactionRepository, txRepo)
    .set(AssetSwapGatewayCtx, assetGateway);

  const createTransaction = new CreateTransactionUseCase().setContext(container);
  const transactionById = new TransactionByIdUseCase().setContext(container);
  const listTransactions = new ListTransactionsUseCase().setContext(container);
  const listTransactionsPage = new ListTransactionsPageUseCase().setContext(container);
  const transactionsByType = new TransactionsByTypeUseCase().setContext(container);
  const transactionsByDateRange = new TransactionsByDateRangeUseCase().setContext(container);
  const swapBalance = new SwapBalanceUseCase().setContext(container);
  const updateTransaction = new UpdateTransactionUseCase().setContext(container);
  const deleteTransaction = new DeleteTransactionUseCase().setContext(container);
  const requestFormTransaction = new RequestFormTransactionUseCase().setContext(container);
  const validateCSRFToken = new ValidateCSRFTokenUseCase().setContext(container);

  container.set(TransactionByIdUseCase, transactionById);

  return TransactionService.init(
    createTransaction,
    transactionById,
    listTransactions,
    listTransactionsPage,
    transactionsByType,
    transactionsByDateRange,
    swapBalance,
    updateTransaction,
    deleteTransaction,
    requestFormTransaction,
    validateCSRFToken,
  );
}

logger.info("Initializing TransactionService...");
export const transactionService = createTransactionService({
  txRepo: new TransactionRepositoryImpl(),
  assetGateway: new LazyAssetSwapGateway(),
});
logger.info("TransactionService initialized");

EventBus.on("asset.swapped", async (payload) => {
  const { userId, fromAssetId, toAssetId, amount, currency, fromAssetName, toAssetName } = payload;
  // Resolve late: composition bisa di-re-init dengan adapter lain (mis. test),
  // jadi subscriber harus memakai singleton yang aktif saat event terjadi.
  await TransactionService.getInstance().createTransaction({
    userId: Number(userId),
    payWithAssetId: Number(fromAssetId),
    payToAssetId: Number(toAssetId),
    amount: Balance.new(`${currency} ${amount}`),
    capital: Balance.zero(),
    type: "transfer",
    category: "Move Balances",
    description: `Swap ( ${fromAssetName} to ${toAssetName} )`,
    status: "success",
  });
});
logger.info("EventBus subscriber 'asset.swapped' registered");
