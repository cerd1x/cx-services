import {
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import type { User } from "../../../user/core/model/user.model";
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

export type PasskeyGenerateRegistrationOptionsInput = {
  user: User;
  rpID: string;
  rpName: string;
};

export class PasskeyGenerateRegistrationOptionsUseCase extends CoreUsecase<
  { options: PublicKeyCredentialCreationOptionsJSON; challenge: string },
  PasskeyGenerateRegistrationOptionsInput
> {
  @logMethod(logger)
  async execute(input: PasskeyGenerateRegistrationOptionsInput): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challenge: string;
  }> {
    const repo = this.deps.get(PasskeyRepository);

    if (!input.user.id) throw new AuthenticationError("userId is required");

    const existing = await repo.findByUserId(input.user.id.toNumb);

    const options = await generateRegistrationOptions({
      rpName: input.rpName,
      rpID: input.rpID,
      userName: input.user.username,
      userDisplayName: input.user.name,
      userID: new TextEncoder().encode(input.user.idHash),
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: parseTransports(credential.transports),
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      attestationType: "none",
    });

    const challenge = await WebAuthnChallenge.issue({
      kind: "register",
      userId: input.user.id.toNumb,
      challenge: options.challenge,
    });

    return { options, challenge };
  }
}
