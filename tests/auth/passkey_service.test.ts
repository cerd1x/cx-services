import { afterEach, describe, expect, it, mock } from "bun:test";
import { createPasskeyService } from "$services/domain/auth";
import { WebAuthnChallenge } from "$services/domain/auth/core/value-objects/webauthn.vo";
import { User } from "$services/domain/user/core/entity/user.entity";
import { ID } from "$services/shared/kernel";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import type { PasskeyRepository } from "$services/domain/auth/core/ports/out/passkey-repository.port";

describe("PasskeyService", () => {
  const repo: Record<string, ReturnType<typeof mock>> = {
    save: mock(),
    findById: mock(),
    findByUserId: mock(),
    updateCounter: mock(),
    deleteByCredentialId: mock(),
  };

  const service = createPasskeyService({ passkeyRepo: repo as any as PasskeyRepository });

  const user = User.new({
    name: "Test",
    username: "testuser",
    email: "test@test.com",
    password: "password123",
  });
  user.id = ID.new(1);

  afterEach(() => {
    for (const m of Object.values(repo)) (m as any).mockClear();
  });

  it("generates authentication options with signed challenge", async () => {
    const { options, challenge } = await service.generateAuthenticationOptions({
      rpID: "example.com",
    });

    expect(options.challenge).toBeTruthy();
    expect(options.rpId).toBe("example.com");
    expect(options.userVerification).toBe("required");

    const payload = await WebAuthnChallenge.verify(challenge, { kind: "auth" });
    expect(payload.challenge).toBe(options.challenge);
  });

  it("generates registration options excluding existing credentials", async () => {
    repo.findByUserId.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        credentialId: "existing-cred",
        publicKey: "key",
        counter: 0,
        transports: null,
        deviceName: null,
        createdAt: "",
      },
    ]);

    const { options, challenge } = await service.generateRegistrationOptions({
      user,
      rpID: "example.com",
      rpName: "cxapp",
    });

    expect(options.excludeCredentials?.map((c) => c.id)).toEqual(["existing-cred"]);
    expect(options.user.name).toBe("testuser");
    expect(options.user.id).toBeTruthy();

    const payload = await WebAuthnChallenge.verify(challenge, { kind: "register", userId: 1 });
    expect(payload.challenge).toBe(options.challenge);
  });

  it("throws when registration options requested without user id", async () => {
    const noIdUser = User.new({
      name: "Test",
      username: "testuser",
      email: "test@test.com",
      password: "password123",
    });

    await expect(
      service.generateRegistrationOptions({ user: noIdUser, rpID: "example.com", rpName: "cxapp" }),
    ).rejects.toThrow("userId is required");
  });

  it("verifyAuthentication throws when credential not found", async () => {
    repo.findById.mockResolvedValue(null);

    const challenge = await WebAuthnChallenge.issue({ kind: "auth", challenge: "raw-challenge" });

    await expect(
      service.verifyAuthentication({
        challenge,
        credentialId: "missing-cred",
        assertionResponse: {} as any,
        origin: "https://example.com",
        rpID: "example.com",
      }),
    ).rejects.toThrow(AuthenticationError);
  });

  it("verifyAuthentication rejects an auth challenge used with a register token", async () => {
    const challenge = await WebAuthnChallenge.issue({
      kind: "register",
      userId: 1,
      challenge: "raw-challenge",
    });

    await expect(
      service.verifyAuthentication({
        challenge,
        credentialId: "cred",
        assertionResponse: {} as any,
        origin: "https://example.com",
        rpID: "example.com",
      }),
    ).rejects.toThrow(AuthenticationError);
  });
});
