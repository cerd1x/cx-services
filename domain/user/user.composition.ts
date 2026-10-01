import { User as UserType } from "./core/entity/user.entity";
import { ID } from "$services/shared/kernel/id";
import { CreateUserUseCase } from "./core/usecase/create-user.usecase";
import { UserByUsernameUseCase } from "./core/usecase/user-by-username.usecase";
import { UserByIdUseCase } from "./core/usecase/user-by-id.usecase";
import { ListUsersUseCase } from "./core/usecase/list-users.usecase";
import { IsUsernameTakenUseCase } from "./core/usecase/is-username-taken.usecase";
import { IsUserIdTakenUseCase } from "./core/usecase/is-user-id-taken.usecase";
import { DeleteUserUseCase } from "./core/usecase/delete-user.usecase";
import { UpdateUserAvatarUseCase } from "./core/usecase/update-user-avatar.usecase";
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
  ) {
    this.#createUser = createUser;
    this.#userByUsername = userByUsername;
    this.#userById = userById;
    this.#listUsers = listUsers;
    this.#isUsernameTaken = isUsernameTaken;
    this.#isUserIdTaken = isUserIdTaken;
    this.#deleteUser = deleteUser;
    this.#updateUserAvatar = updateUserAvatar;
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
  );
}

logger.info("Initializing UserService...");
export const userService = createUserService({ userRepo: new UserRepositoryImpl() });
logger.info("UserService initialized");
