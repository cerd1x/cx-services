import { User } from "./../user/adapters/driven/drizzle/user.entity";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "./core/value-objects/logger";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { SignUpUseCase } from "./core/usecase/sign-up.usecase";
import { SignInUseCase } from "./core/usecase/sign-in.usecase";
import { SignOutUseCase } from "./core/usecase/sign-out.usecase";
import { AuthorizeUseCase } from "./core/usecase/authorize.usecase";
import { PasskeyRegistrationOptionsUseCase } from "./core/usecase/passkey-registration-options.usecase";
import { RegisterPasskeyUseCase } from "./core/usecase/register-passkey.usecase";
import { PasskeyAuthenticationOptionsUseCase } from "./core/usecase/passkey-authentication-options.usecase";
import { ListPasskeysUseCase } from "./core/usecase/list-passkeys.usecase";
import { DeletePasskeyUseCase } from "./core/usecase/delete-passkey.usecase";
import { SignInWithPassKeyUseCase } from "./core/usecase/sign-in-with-passkey.usecase";
import { type PasskeyRecord, PasskeyRepository } from "./core/ports/out/passkey-repository.port";
import { PasskeyFindByUserIdUseCase } from "./core/usecase/passkey-find-by-user-id.usecase";
import { PasskeyDeleteUseCase } from "./core/usecase/passkey-delete.usecase";
import { PasskeyGenerateRegistrationOptionsUseCase } from "./core/usecase/passkey-generate-registration-options.usecase";
import { PasskeyRegisterUseCase } from "./core/usecase/passkey-register.usecase";
import { PasskeyGenerateAuthenticationOptionsUseCase } from "./core/usecase/passkey-generate-authentication-options.usecase";
import { PasskeyVerifyAuthenticationUseCase } from "./core/usecase/passkey-verify-authentication.usecase";
import { ServiceContainer } from "$services/shared/base";
import { settingService, type SettingService } from "$services/domain/setting";
import { userService } from "$services/domain/user";
import { AuthRepositoryImpl } from "./adapters/driven/drizzle/auth.repository";
import { PasskeyRepositoryImpl } from "./adapters/driven/drizzle/passkey.repository";
import { AuthRepository } from "./core/ports/out/auth-repository.port";
import { PasskeyServiceCtx, SettingServiceCtx, UserServiceLikeCtx } from "./core/usecase/ctx";
import { type UserServiceLike } from "./core/types/user-service-like";
import { IssueSessionUseCase } from "./core/usecase/issue-session.usecase";

export type AuthPasskeyUsecases = {
  passkeyRegistrationOptions: PasskeyRegistrationOptionsUseCase;
  registerPasskey: RegisterPasskeyUseCase;
  passkeyAuthenticationOptions: PasskeyAuthenticationOptionsUseCase;
  listPasskeys: ListPasskeysUseCase;
  deletePasskey: DeletePasskeyUseCase;
  signInWithPassKey: SignInWithPassKeyUseCase;
} | null;

export class AuthService {
  static #instanceAuthService: AuthService;
  #signUp: SignUpUseCase;
  #signIn: SignInUseCase;
  #signOut: SignOutUseCase;
  #authorize: AuthorizeUseCase;
  #passkeyRegistrationOptions: PasskeyRegistrationOptionsUseCase | null = null;
  #registerPasskey: RegisterPasskeyUseCase | null = null;
  #passkeyAuthenticationOptions: PasskeyAuthenticationOptionsUseCase | null = null;
  #listPasskeys: ListPasskeysUseCase | null = null;
  #deletePasskey: DeletePasskeyUseCase | null = null;
  #signInWithPassKey: SignInWithPassKeyUseCase | null = null;
  #passkeyService?: PasskeyService;

  @logMethod(logger)
  static init(
    signUp: SignUpUseCase,
    signIn: SignInUseCase,
    signOut: SignOutUseCase,
    authorize: AuthorizeUseCase,
    passkeyService?: PasskeyService,
    passkeyUsecases: AuthPasskeyUsecases = null,
  ): AuthService {
    AuthService.#instanceAuthService = new AuthService(
      signUp,
      signIn,
      signOut,
      authorize,
      passkeyService,
      passkeyUsecases,
    );
    return AuthService.#instanceAuthService;
  }

  @logMethod(logger)
  static getInstance(): AuthService {
    if (!AuthService.#instanceAuthService) {
      throw new Error("AuthService not initialized");
    }
    return AuthService.#instanceAuthService;
  }

  private constructor(
    signUp: SignUpUseCase,
    signIn: SignInUseCase,
    signOut: SignOutUseCase,
    authorize: AuthorizeUseCase,
    passkeyService?: PasskeyService,
    passkeyUsecases: AuthPasskeyUsecases = null,
  ) {
    this.#signUp = signUp;
    this.#signIn = signIn;
    this.#signOut = signOut;
    this.#authorize = authorize;
    this.#passkeyService = passkeyService;

    if (passkeyUsecases) {
      this.#passkeyRegistrationOptions = passkeyUsecases.passkeyRegistrationOptions;
      this.#registerPasskey = passkeyUsecases.registerPasskey;
      this.#passkeyAuthenticationOptions = passkeyUsecases.passkeyAuthenticationOptions;
      this.#listPasskeys = passkeyUsecases.listPasskeys;
      this.#deletePasskey = passkeyUsecases.deletePasskey;
      this.#signInWithPassKey = passkeyUsecases.signInWithPassKey;
    }
  }

  @logMethod(logger)
  async signUp(user: User): Promise<{ user: User; session: string; refreshToken: string }> {
    return this.#signUp.execute(user);
  }

  @logMethod(logger)
  async signIn(
    username: string,
    password: string,
  ): Promise<{ user: User; session: string; refreshToken: string }> {
    return this.#signIn.execute({ username, password });
  }

  @logMethod(logger)
  async passkeyRegistrationOptions(input: { userId: number; rpID: string; rpName: string }) {
    if (!this.#passkeyRegistrationOptions) throw new Error("PasskeyService not configured");
    return this.#passkeyRegistrationOptions.execute(input);
  }

  @logMethod(logger)
  async registerPasskey(input: {
    userId: number;
    challenge: string;
    attestationResponse: RegistrationResponseJSON;
    origin: string;
    rpID: string;
    deviceName?: string;
  }): Promise<void> {
    if (!this.#registerPasskey) throw new Error("PasskeyService not configured");
    await this.#registerPasskey.execute(input);
  }

  @logMethod(logger)
  async passkeyAuthenticationOptions(input: { rpID: string }) {
    if (!this.#passkeyAuthenticationOptions) throw new Error("PasskeyService not configured");
    return this.#passkeyAuthenticationOptions.execute(input);
  }

  @logMethod(logger)
  async listPasskeys(userId: number) {
    if (!this.#listPasskeys) throw new Error("PasskeyService not configured");
    return this.#listPasskeys.execute(userId);
  }

  @logMethod(logger)
  async deletePasskey(userId: number, credentialId: string): Promise<boolean> {
    if (!this.#deletePasskey) throw new Error("PasskeyService not configured");
    return this.#deletePasskey.execute({ userId, credentialId });
  }

  @logMethod(logger)
  async signInWithPassKey(input: {
    challenge: string;
    credentialId: string;
    assertionResponse: AuthenticationResponseJSON;
    origin: string;
    rpID: string;
  }): Promise<{ user: User; session: string; refreshToken: string }> {
    if (!this.#signInWithPassKey) throw new Error("PasskeyService not configured");
    return this.#signInWithPassKey.execute(input);
  }

  @logMethod(logger)
  async signOut(sessionToken: string, refreshToken?: string): Promise<void> {
    await this.#signOut.execute({ sessionToken, refreshToken });
  }

  @logMethod(logger)
  async authorize(token: string): Promise<{
    user: User;
    token: { session: string | null; refresh: string | null } | null;
  }> {
    return this.#authorize.execute(token);
  }
}

export class PasskeyService {
  static #instancePasskeyService: PasskeyService;
  #findByUserId: PasskeyFindByUserIdUseCase;
  #delete: PasskeyDeleteUseCase;
  #generateRegistrationOptions: PasskeyGenerateRegistrationOptionsUseCase;
  #register: PasskeyRegisterUseCase;
  #generateAuthenticationOptions: PasskeyGenerateAuthenticationOptionsUseCase;
  #verifyAuthentication: PasskeyVerifyAuthenticationUseCase;

  static init(
    findByUserId: PasskeyFindByUserIdUseCase,
    deletePasskey: PasskeyDeleteUseCase,
    generateRegistrationOptions: PasskeyGenerateRegistrationOptionsUseCase,
    register: PasskeyRegisterUseCase,
    generateAuthenticationOptions: PasskeyGenerateAuthenticationOptionsUseCase,
    verifyAuthentication: PasskeyVerifyAuthenticationUseCase,
  ): PasskeyService {
    PasskeyService.#instancePasskeyService = new PasskeyService(
      findByUserId,
      deletePasskey,
      generateRegistrationOptions,
      register,
      generateAuthenticationOptions,
      verifyAuthentication,
    );
    return PasskeyService.#instancePasskeyService;
  }

  static getInstance(): PasskeyService {
    if (!PasskeyService.#instancePasskeyService) {
      throw new Error("PasskeyService not initialized");
    }
    return PasskeyService.#instancePasskeyService;
  }

  private constructor(
    findByUserId: PasskeyFindByUserIdUseCase,
    deletePasskey: PasskeyDeleteUseCase,
    generateRegistrationOptions: PasskeyGenerateRegistrationOptionsUseCase,
    register: PasskeyRegisterUseCase,
    generateAuthenticationOptions: PasskeyGenerateAuthenticationOptionsUseCase,
    verifyAuthentication: PasskeyVerifyAuthenticationUseCase,
  ) {
    this.#findByUserId = findByUserId;
    this.#delete = deletePasskey;
    this.#generateRegistrationOptions = generateRegistrationOptions;
    this.#register = register;
    this.#generateAuthenticationOptions = generateAuthenticationOptions;
    this.#verifyAuthentication = verifyAuthentication;
  }

  async findByUserId(userId: number): Promise<PasskeyRecord[]> {
    return this.#findByUserId.execute(userId);
  }

  async delete(input: { userId: number; credentialId: string }): Promise<boolean> {
    return this.#delete.execute(input);
  }

  async generateRegistrationOptions(input: {
    user: User;
    rpID: string;
    rpName: string;
  }): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challenge: string }> {
    return this.#generateRegistrationOptions.execute(input);
  }

  async register(input: {
    userId: number;
    challenge: string;
    attestationResponse: RegistrationResponseJSON;
    origin: string;
    rpID: string;
    deviceName?: string;
  }): Promise<void> {
    return this.#register.execute(input);
  }

  async generateAuthenticationOptions(input: {
    rpID: string;
  }): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challenge: string }> {
    return this.#generateAuthenticationOptions.execute(input);
  }

  async verifyAuthentication(input: {
    challenge: string;
    credentialId: string;
    assertionResponse: AuthenticationResponseJSON;
    origin: string;
    rpID: string;
  }): Promise<{ userId: number }> {
    return this.#verifyAuthentication.execute(input);
  }
}

export type PasskeyAdapters = {
  passkeyRepo: PasskeyRepository;
};

export function createPasskeyService({ passkeyRepo }: PasskeyAdapters): PasskeyService {
  const container = new ServiceContainer().set(PasskeyRepository, passkeyRepo);

  const findByUserId = new PasskeyFindByUserIdUseCase().setContext(container);
  const deletePasskey = new PasskeyDeleteUseCase().setContext(container);
  const generateRegistrationOptions = new PasskeyGenerateRegistrationOptionsUseCase().setContext(
    container,
  );
  const register = new PasskeyRegisterUseCase().setContext(container);
  const generateAuthenticationOptions =
    new PasskeyGenerateAuthenticationOptionsUseCase().setContext(container);
  const verifyAuthentication = new PasskeyVerifyAuthenticationUseCase().setContext(container);

  return PasskeyService.init(
    findByUserId,
    deletePasskey,
    generateRegistrationOptions,
    register,
    generateAuthenticationOptions,
    verifyAuthentication,
  );
}

export type AuthAdapters = {
  userService: UserServiceLike;
  authRepo: AuthRepository;
  settingService: SettingService;
  passkeyService?: PasskeyService;
};

export function createAuthService({
  userService,
  authRepo,
  settingService,
  passkeyService,
}: AuthAdapters): AuthService {
  const container = new ServiceContainer()
    .set(UserServiceLikeCtx, userService)
    .set(AuthRepository, authRepo)
    .set(SettingServiceCtx, settingService as unknown as SettingServiceCtx);

  const issueSession = new IssueSessionUseCase().setContext(container);
  container.set(IssueSessionUseCase, issueSession);

  const signUp = new SignUpUseCase().setContext(container);
  const signIn = new SignInUseCase().setContext(container);
  const signOut = new SignOutUseCase().setContext(container);
  const authorize = new AuthorizeUseCase().setContext(container);

  const passkeyUsecases = passkeyService
    ? (() => {
        container.set(PasskeyServiceCtx, passkeyService as unknown as PasskeyServiceCtx);
        return {
          passkeyRegistrationOptions: new PasskeyRegistrationOptionsUseCase().setContext(container),
          registerPasskey: new RegisterPasskeyUseCase().setContext(container),
          passkeyAuthenticationOptions: new PasskeyAuthenticationOptionsUseCase().setContext(
            container,
          ),
          listPasskeys: new ListPasskeysUseCase().setContext(container),
          deletePasskey: new DeletePasskeyUseCase().setContext(container),
          signInWithPassKey: new SignInWithPassKeyUseCase().setContext(container),
        };
      })()
    : null;

  return AuthService.init(signUp, signIn, signOut, authorize, passkeyService, passkeyUsecases);
}

logger.info("Initializing AuthService...");
export const passkeyService = createPasskeyService({
  passkeyRepo: new PasskeyRepositoryImpl(),
});
export const authService = createAuthService({
  userService,
  authRepo: new AuthRepositoryImpl(),
  settingService,
  passkeyService,
});
logger.info("AuthService initialized");
