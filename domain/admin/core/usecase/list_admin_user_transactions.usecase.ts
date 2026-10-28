import { AdminRepository } from "../ports/out/admin-repository.port";
import {
  ADMIN_PAGE_DEFAULT_LIMIT,
  ADMIN_PAGE_MAX_LIMIT,
  type AdminTransactionView,
} from "../model/admin.model";
import { ID } from "$services/shared/kernel/id";
import { ValidationError } from "$services/shared/kernel/errors/service-error";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ListAdminUserTransactionsInput = {
  userId: ID;
  limit?: number | null;
};

/** Transaksi milik seorang user, dilihat dari sisi admin. */
export class ListAdminUserTransactionsUseCase extends CoreUsecase<
  AdminTransactionView[],
  ListAdminUserTransactionsInput
> {
  @logMethod(logger)
  async execute(input: ListAdminUserTransactionsInput): Promise<AdminTransactionView[]> {
    const adminRepo = this.deps.get(AdminRepository);
    const userId = input.userId.decode;

    const requested = input.limit ?? ADMIN_PAGE_DEFAULT_LIMIT;
    if (!Number.isInteger(requested) || requested <= 0) {
      throw new ValidationError("limit must be a positive integer");
    }
    if (requested > ADMIN_PAGE_MAX_LIMIT) {
      throw new ValidationError(`limit must not exceed ${ADMIN_PAGE_MAX_LIMIT}`);
    }

    return adminRepo.listUserTransactions(userId, requested);
  }
}
