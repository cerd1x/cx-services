import type { PasskeyService } from "$services/domain/auth";
import { PasskeyServiceCtx } from "./ctx";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type RegisterPasskeyInput = {
  userId: number;
  challenge: string;
  attestationResponse: RegistrationResponseJSON;
  origin: string;
  rpID: string;
  deviceName?: string;
};

export class RegisterPasskeyUseCase extends CoreUsecase<void, RegisterPasskeyInput> {
  @logMethod(logger)
  async execute(input: RegisterPasskeyInput): Promise<void> {
    const passkeyService = this.deps.get(PasskeyServiceCtx) as unknown as PasskeyService;
    await passkeyService.register(input);
  }
}