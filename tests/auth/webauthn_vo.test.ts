import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { WebAuthnChallenge } from "$services/domain/auth/core/value-objects/webauthn.vo";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";

describe("WebAuthnChallenge", () => {
  const realNow = Date.now;

  afterEach(() => {
    Date.now = realNow;
  });

  it("issues and verifies a register challenge", async () => {
    const token = await WebAuthnChallenge.issue({
      kind: "register",
      userId: 7,
      challenge: "abc-123",
    });

    const payload = await WebAuthnChallenge.verify(token, { kind: "register", userId: 7 });

    expect(payload.challenge).toBe("abc-123");
    expect(payload.userId).toBe(7);
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it("issues and verifies an auth challenge without userId", async () => {
    const token = await WebAuthnChallenge.issue({ kind: "auth", challenge: "xyz-456" });

    const payload = await WebAuthnChallenge.verify(token, { kind: "auth" });

    expect(payload.challenge).toBe("xyz-456");
    expect(payload.userId).toBeUndefined();
  });

  it("rejects when kind mismatches", async () => {
    const token = await WebAuthnChallenge.issue({ kind: "auth", challenge: "abc" });

    await expect(WebAuthnChallenge.verify(token, { kind: "register" })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("rejects when userId mismatches", async () => {
    const token = await WebAuthnChallenge.issue({ kind: "register", userId: 1, challenge: "abc" });

    await expect(WebAuthnChallenge.verify(token, { kind: "register", userId: 2 })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("rejects tampered token", async () => {
    const token = await WebAuthnChallenge.issue({ kind: "auth", challenge: "abc" });
    const [encoded] = token.split(".");

    await expect(WebAuthnChallenge.verify(`${encoded}.tampered`, { kind: "auth" })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("rejects malformed token", async () => {
    await expect(WebAuthnChallenge.verify("not-a-token", { kind: "auth" })).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("rejects expired challenge", async () => {
    let now = Date.now();
    spyOn(Date, "now").mockReturnValue(now);

    const token = await WebAuthnChallenge.issue({ kind: "auth", challenge: "abc" });

    now += 6 * 60 * 1000;
    spyOn(Date, "now").mockReturnValue(now);

    await expect(WebAuthnChallenge.verify(token, { kind: "auth" })).rejects.toThrow(
      "Challenge expired",
    );
  });
});
