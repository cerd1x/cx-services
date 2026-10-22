import { User as UserType, type UserRole } from "./core/model/user.model";
import { ID } from "$services/shared/kernel/id";
import { CreateUserUseCase } from "./core/usecase/create_user.usecase";
import { UserByUsernameUseCase } from "./core/usecase/user_by_username.usecase";
import { UserByIdUseCase } from "./core/usecase/user_by_id.usecase";
import { ListUsersUseCase } from "./core/usecase/list_users.usecase";
import { IsUsernameTakenUseCase } from "./core/usecase/is_username_taken.usecase";
import { IsUserIdTakenUseCase } from "./core/usecase/is_user_id_taken.usecase";
import { DeleteUserUseCase } from "./core/usecase/delete_user.usecase";
import { UpdateUserAvatarUseCase } from "./core/usecase/update_user_avatar.usecase";
import { UpdateUserRoleUseCase } from "./core/usecase/update_user_role.usecase";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import { ServiceContainer } from "$services/shared/base";
import { UserRepositoryImpl } from "./adapters/driven/drizzle/user.repository";
import { UserRepository } from "./core/ports/out/user-repository.port";

export class UserService {
  static #instanceUserService: UserService;
  #createUser: CreateUserUseCase;
  #userByUsername: UserByUsernameUseCase;
  #userById: UserByIdUseCase;
  #listUsers: ListUsersUseCase;
  #isUsernameTaken: IsUsernameTakenUseCase;
  #isUserIdTaken: IsUserIdTakenUseCase;
  #deleteUser: DeleteUserUseCase;
  #updateUserAvatar: UpdateUserAvatarUseCase;
  #updateUserRole: UpdateUserRoleUseCase;

  @logMethod(logger)
  static init(
    createUser: CreateUserUseCase,
    userByUsername: UserByUsernameUseCase,
    userById: UserByIdUseCase,
    listUsers: ListUsersUseCase,
    isUsernameTaken: IsUsernameTakenUseCase,
    isUserIdTaken: IsUserIdTakenUseCase,
    deleteUser: DeleteUserUseCase,
    updateUserAvatar: UpdateUserAvatarUseCase,
    updateUserRole: UpdateUserRoleUseCase,
  ): UserService {
    UserService.#instanceUserService = new UserService(
      createUser,
      userByUsername,
      userById,
      listUsers,
      isUsernameTaken,
      isUserIdTaken,
      deleteUser,
      updateUserAvatar,
      updateUserRole,
    );
    return UserService.#instanceUserService;
  }

  @logMethod(logger)
  static getInstance(): UserService {
    if (!UserService.#instanceUserService) {
      throw new Error("UserService not initialized");
    }
    return UserService.#instanceUserService;
  }

  private constructor(
    createUser: CreateUserUseCase,
    userByUsername: UserByUsernameUseCase,
    userById: UserByIdUseCase,
    listUsers: ListUsersUseCase,
    isUsernameTaken: IsUsernameTakenUseCase,
    isUserIdTaken: IsUserIdTakenUseCase,
    deleteUser: DeleteUserUseCase,
    updateUserAvatar: UpdateUserAvatarUseCase,
    updateUserRole: UpdateUserRoleUseCase,
  ) {
    this.#createUser = createUser;
    this.#userByUsername = userByUsername;
    this.#userById = userById;
    this.#listUsers = listUsers;
    this.#isUsernameTaken = isUsernameTaken;
    this.#isUserIdTaken = isUserIdTaken;
    this.#deleteUser = deleteUser;
    this.#updateUserAvatar = updateUserAvatar;
    this.#updateUserRole = updateUserRole;
  }

  @logMethod(logger)
  async createUser(
    name: string,
    username: string,
    password: string,
    email?: string,
  ): Promise<UserType> {
    return this.#createUser.execute({ name, username, password, email });
  }

  @logMethod(logger)
  async isUsernameTaken(username: string): Promise<boolean> {
    return this.#isUsernameTaken.execute(username);
  }

  @logMethod(logger)
  async isUserIdTaken(userId: ID): Promise<boolean> {
    return this.#isUserIdTaken.execute(userId);
  }

  @logMethod(logger)
  async users(): Promise<UserType[]> {
    return this.#listUsers.execute();
  }

  @logMethod(logger)
  async userByUsername(username: string): Promise<UserType> {
    return this.#userByUsername.execute(username);
  }

  @logMethod(logger)
  async user(id: ID): Promise<UserType> {
    return this.#userById.execute(id);
  }

  @logMethod(logger)
  async deleteUser(userId: ID): Promise<boolean> {
    return this.#deleteUser.execute(userId);
  }

  @logMethod(logger)
  async updateUserAvatar(id: ID, avatarUrl?: string | null): Promise<UserType> {
    return this.#updateUserAvatar.execute({ id, avatarUrl });
  }

  @logMethod(logger)
  async updateUserRole(id: ID, role: UserRole | string): Promise<UserType> {
    return this.#updateUserRole.execute({ id, role });
  }
}

export type UserAdapters = {
  userRepo: UserRepository;
};

export function createUserService({ userRepo }: UserAdapters): UserService {
  const container = new ServiceContainer().set(UserRepository, userRepo);

  const createUser = new CreateUserUseCase().setContext(container);
  const userByUsername = new UserByUsernameUseCase().setContext(container);
  const userById = new UserByIdUseCase().setContext(container);
  const listUsers = new ListUsersUseCase().setContext(container);
  const isUsernameTaken = new IsUsernameTakenUseCase().setContext(container);
  const isUserIdTaken = new IsUserIdTakenUseCase().setContext(container);
  const deleteUser = new DeleteUserUseCase().setContext(container);
  const updateUserAvatar = new UpdateUserAvatarUseCase().setContext(container);
  const updateUserRole = new UpdateUserRoleUseCase().setContext(container);

  container.set(CreateUserUseCase, createUser);
  container.set(UserByIdUseCase, userById);

  return UserService.init(
    createUser,
    userByUsername,
    userById,
    listUsers,
    isUsernameTaken,
    isUserIdTaken,
    deleteUser,
    updateUserAvatar,
    updateUserRole,
  );
}

logger.info("Initializing UserService...");
export const userService = createUserService({ userRepo: new UserRepositoryImpl() });
logger.info("UserService initialized");
