import { AdminRepositoryImpl } from "./adapters/driven/drizzle/admin.repository";
import { AdminRepository } from "./core/ports/out/admin-repository.port";
import { GetAdminOverviewUseCase } from "./core/usecase/get-admin-overview.usecase";
import { ListAdminUserTransactionsUseCase } from "./core/usecase/list-admin-user-transactions.usecase";
import { ListAdminUsersUseCase } from "./core/usecase/list-admin-users.usecase";
import { DeleteAnyUserUseCase } from "./core/usecase/delete-any-user.usecase";
import { SetUserRoleUseCase } from "./core/usecase/set-user-role.usecase";
import { UserServiceCtx } from "./core/usecase/ctx";
import type { AdminOverview, AdminTransactionView, AdminUserView } from "./core/model/admin.model";
import type { UserType } from "$services/domain/user";
import { ServiceContainer } from "$services/shared/base";
import { ID } from "$services/shared/kernel/id";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { userService } from "$services/domain/user";
import { logger } from "./core/value-objects/logger";

/**
 * Service admin.
 *
 * Kelas ini hanya facade — seluruh pekerjaan ada di use case. Semua method di
 * sini **wajib** dipanggil dari resolver yang ditandai `@admin`; service ini
 * tidak mengulang cek role supaya tidak ada dua sumber kebenaran yang bisa
 * berbeda.
 */
export class AdminService {
  static #instanceAdminService: AdminService;
  #listUsers: ListAdminUsersUseCase;
  #getOverview: GetAdminOverviewUseCase;
  #listUserTransactions: ListAdminUserTransactionsUseCase;
  #setUserRole: SetUserRoleUseCase;
  #deleteAnyUser: DeleteAnyUserUseCase;

  @logMethod(logger)
  static init(
    listUsers: ListAdminUsersUseCase,
    getOverview: GetAdminOverviewUseCase,
    listUserTransactions: ListAdminUserTransactionsUseCase,
    setUserRole: SetUserRoleUseCase,
    deleteAnyUser: DeleteAnyUserUseCase,
  ): AdminService {
    AdminService.#instanceAdminService = new AdminService(
      listUsers,
      getOverview,
      listUserTransactions,
      setUserRole,
      deleteAnyUser,
    );
    return AdminService.#instanceAdminService;
  }

  @logMethod(logger)
  static getInstance(): AdminService {
    if (!AdminService.#instanceAdminService) {
      throw new Error("AdminService not initialized");
    }
    return AdminService.#instanceAdminService;
  }

  private constructor(
    listUsers: ListAdminUsersUseCase,
    getOverview: GetAdminOverviewUseCase,
    listUserTransactions: ListAdminUserTransactionsUseCase,
    setUserRole: SetUserRoleUseCase,
    deleteAnyUser: DeleteAnyUserUseCase,
  ) {
    this.#listUsers = listUsers;
    this.#getOverview = getOverview;
    this.#listUserTransactions = listUserTransactions;
    this.#setUserRole = setUserRole;
    this.#deleteAnyUser = deleteAnyUser;
  }

  @logMethod(logger)
  async users(): Promise<AdminUserView[]> {
    return this.#listUsers.execute();
  }

  @logMethod(logger)
  async overview(): Promise<AdminOverview> {
    return this.#getOverview.execute();
  }

  @logMethod(logger)
  async userTransactions(userId: ID, limit?: number | null): Promise<AdminTransactionView[]> {
    return this.#listUserTransactions.execute({ userId, limit });
  }

  @logMethod(logger)
  async setUserRole(userId: ID, role: string, actorId: ID): Promise<UserType> {
    return this.#setUserRole.execute({ userId, role, actorId });
  }

  @logMethod(logger)
  async deleteUser(userId: ID, actorId: ID): Promise<boolean> {
    return this.#deleteAnyUser.execute({ userId, actorId });
  }
}

export type AdminAdapters = {
  adminRepo: AdminRepository;
  userServiceLike: UserServiceCtx;
};

export function createAdminService({ adminRepo, userServiceLike }: AdminAdapters): AdminService {
  const container = new ServiceContainer()
    .set(AdminRepository, adminRepo)
    .set(UserServiceCtx, userServiceLike);

  const listUsers = new ListAdminUsersUseCase().setContext(container);
  const getOverview = new GetAdminOverviewUseCase().setContext(container);
  const listUserTransactions = new ListAdminUserTransactionsUseCase().setContext(container);
  const setUserRole = new SetUserRoleUseCase().setContext(container);
  const deleteAnyUser = new DeleteAnyUserUseCase().setContext(container);

  return AdminService.init(
    listUsers,
    getOverview,
    listUserTransactions,
    setUserRole,
    deleteAnyUser,
  );
}

logger.info("Initializing AdminService...");
export const adminService = createAdminService({
  adminRepo: new AdminRepositoryImpl(),
  userServiceLike: userService as unknown as UserServiceCtx,
});
logger.info("AdminService initialized");
