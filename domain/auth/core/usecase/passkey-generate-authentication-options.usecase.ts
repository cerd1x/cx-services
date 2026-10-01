import {
  generateAuthenticationOptions,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { WebAuthnChallenge } from "../value-objects/webauthn.vo";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type PasskeyGenerateAuthenticationOptionsInput = {
  rpID: string;
};

export class PasskeyGenerateAuthenticationOptionsUseCase extends CoreUsecase<
  { options: PublicKeyCredentialRequestOptionsJSON; challenge: string },
  PasskeyGenerateAuthenticationOptionsInput
> {
  @logMethod(logger)
  async execute(input: PasskeyGenerateAuthenticationOptionsInput): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challenge: string;
  }> {
    const options = await generateAuthenticationOptions({
      rpID: input.rpID,
      userVerification: "required",
    });

    const challenge = await WebAuthnChallenge.issue({
      kind: "auth",
      challenge: options.challenge,
    });

    return { options, challenge };
  }
}