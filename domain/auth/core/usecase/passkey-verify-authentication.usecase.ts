import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { WebAuthnChallenge } from "../value-objects/webauthn.vo";
import { PasskeyRepository } from "../ports/out/passkey-repository.port";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

function parseTransports(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type PasskeyVerifyAuthenticationInput = {
  challenge: string;
  credentialId: string;
  assertionResponse: AuthenticationResponseJSON;
  origin: string;
  rpID: string;
};

export class PasskeyVerifyAuthenticationUseCase extends CoreUsecase<
  { userId: number },
  PasskeyVerifyAuthenticationInput
> {
  @logMethod(logger)
  async execute(input: PasskeyVerifyAuthenticationInput): Promise<{ userId: number }> {
    const repo = this.deps.get(PasskeyRepository);

    const payload = await WebAuthnChallenge.verify(input.challenge, { kind: "auth" });

    const credential = await repo.findById(input.credentialId);
    if (!credential) throw new AuthenticationError("Passkey not found");

    const verification = await verifyAuthenticationResponse({
      response: input.assertionResponse,
      expectedChallenge: payload.challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.rpID,
      credential: {
        id: credential.credentialId,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: parseTransports(credential.transports),
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw new AuthenticationError("Passkey authentication failed");
    }

    const { newCounter } = verification.authenticationInfo;
    if (newCounter > 0 && newCounter <= credential.counter) {
      throw new AuthenticationError("Passkey replay detected");
    }

    await repo.updateCounter(credential.credentialId, newCounter);

    return { userId: credential.userId };
  }
}