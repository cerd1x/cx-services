import { describe, expect, it } from "bun:test";
import { Token } from "$services/domain/auth/core/value-objects/token.vo";

describe("Token", () => {
  it("create with valid input", () => {
    const token = Token.create({ userId: 1 });

    expect(token.userId).toBe(1);
    expect(token.type).toBe("session");
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("create with custom expiresAt and type", () => {
    const future = new Date(Date.now() + 10_000);
    const token = Token.create({ userId: 2, expiresAt: future, type: "refresh" });

    expect(token.userId).toBe(2);
    expect(token.type).toBe("refresh");
    expect(token.expiresAt.getTime()).toBe(future.getTime());
  });

  it("create throws on invalid userId", () => {
    expect(() => Token.create({ userId: -1 })).toThrow();
    expect(() => Token.create({ userId: 0 })).toThrow();
  });

  it("create throws on past expiresAt", () => {
    expect(() => Token.create({ userId: 1, expiresAt: new Date("2020-01-01") })).toThrow();
  });

  it("isExpired returns false for future date", () => {
    const token = Token.create({
      userId: 1,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    expect(token.isExpired()).toBe(false);
  });

  it("isExpired returns true for past date", () => {
    const token = Token.create({ userId: 1 });
    token.setExpireAt(Date.now() - 1000);
    expect(token.isExpired()).toBe(true);
  });

  it("setType updates the token type in place", () => {
    const token = Token.create({ userId: 1 });
    const updated = token.setType("refresh");

    expect(token.type).toBe("refresh");
    expect(updated.type).toBe("refresh");
    expect(updated).toBe(token);
  });

  it("setExpireAt updates the token expiresAt in place", () => {
    const token = Token.create({ userId: 1 });
    const future = Date.now() + 7 * 86_400_000;
    const updated = token.setExpireAt(future);

    expect(token.expiresAt.getTime()).toBe(future);
    expect(updated.expiresAt.getTime()).toBe(future);
    expect(updated).toBe(token);
  });

  it("metadata returns TokenData snapshot", () => {
    const future = new Date(Date.now() + 86_400_000);
    const token = Token.create({ userId: 1, expiresAt: future, type: "refresh" });
    const meta = token.metadata;

    expect(meta.userId).toBe(1);
    expect(meta.type).toBe("refresh");
    expect(meta.expiresAt).toBe(future);
  });

  it("setDefaultExpireAt changes default expiration", () => {
    Token.setDefaultExpireAt(60_000);
    const token = Token.create({ userId: 1 });
    const diff = token.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(50_000);
    expect(diff).toBeLessThan(70_000);
  });

  it("default type is session", () => {
    const token = Token.create({ userId: 1 });
    expect(token.type).toBe("session");
  });

  it("generate returns a valid JWT string", () => {
    const token = Token.create({ userId: 1 });
    const jwt = token.generate();

    expect(typeof jwt).toBe("string");
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("verify returns correct payload for valid token", () => {
    const future = new Date(Date.now() + 86_400_000);
    const token = Token.create({ userId: 42, expiresAt: future, type: "refresh" });
    const jwt = token.generate();

    const decoded = token.verify(jwt);

    expect(decoded.userId).toBe(42);
    expect(decoded.type).toBe("refresh");
    expect(decoded.expiresAt.getTime()).toBe(future.getTime());
  });

  it("verify throws for tampered token", () => {
    const token = Token.create({ userId: 1 });
    const jwt = token.generate();
    const tampered = jwt.slice(0, -5) + "XXXXX";

    expect(() => token.verify(tampered)).toThrow("invalid token");
  });

  it("decode returns correct payload without verification", () => {
    const future = new Date(Date.now() + 86_400_000);
    const token = Token.create({ userId: 7, expiresAt: future, type: "session" });
    const jwt = token.generate();

    const decoded = token.decode(jwt);

    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(7);
    expect(decoded!.type).toBe("session");
    expect(decoded!.expiresAt.getTime()).toBe(future.getTime());
  });

  it("decode returns null for garbage input", () => {
    const token = Token.create({ userId: 1 });

    const result = token.decode("not-a-token");

    expect(result).toBeNull();
  });

  it("decode returns null for empty string", () => {
    const token = Token.create({ userId: 1 });

    const result = token.decode("");

    expect(result).toBeNull();
  });
});
