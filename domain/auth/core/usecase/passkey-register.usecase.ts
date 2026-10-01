import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { WebAuthnChallenge } from "../value-objects/webauthn.vo";
import { PasskeyRepository } from "../ports/out/passkey-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type PasskeyRegisterInput = {
  userId: number;
  challenge: string;
  attestationResponse: RegistrationResponseJSON;
  origin: string;
  rpID: string;
  deviceName?: string;
};

export class PasskeyRegisterUseCase extends CoreUsecase<void, PasskeyRegisterInput> {
  @logMethod(logger)
  async execute(input: PasskeyRegisterInput): Promise<void> {
    const repo = this.deps.get(PasskeyRepository);

    const payload = await WebAuthnChallenge.verify(input.challenge, {
      kind: "register",
      userId: input.userId,
    });

    const verification = await verifyRegistrationResponse({
      response: input.attestationResponse,
      expectedChallenge: payload.challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new AuthenticationError("Passkey registration failed");
    }

    const credential = verification.registrationInfo.credential;

    if (await repo.findById(credential.id)) {
      throw new AuthenticationError("Passkey already registered");
    }

    const transports =
      input.attestationResponse.response.transports?.length
        ? JSON.stringify(input.attestationResponse.response.transports)
        : null;

    await repo.save({
      userId: input.userId,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports,
      deviceName: input.deviceName ?? null,
    });
  }
}