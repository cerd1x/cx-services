import { describe, expect, it } from "bun:test";
import { PasswordUtils } from "$services/shared/kernel/password-utils";

describe("PasswordUtils", () => {
  describe("hash", () => {
    it("returns a hashed string with correct format", async () => {
      const hash = await PasswordUtils.hash("test1234");

      expect(hash).toMatch(/^\$pbkdf2-sha256\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    });

    it("produces different hashes for same password (different salt)", async () => {
      const hash1 = await PasswordUtils.hash("test1234");
      const hash2 = await PasswordUtils.hash("test1234");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verify", () => {
    it("returns true for correct password", async () => {
      const hash = await PasswordUtils.hash("test1234");
      const result = await PasswordUtils.verify("test1234", hash);

      expect(result).toBe(true);
    });

    it("returns false for incorrect password", async () => {
      const hash = await PasswordUtils.hash("test1234");
      const result = await PasswordUtils.verify("wrongpassword", hash);

      expect(result).toBe(false);
    });

    it("rejects empty password", async () => {
      await expect(PasswordUtils.hash("")).rejects.toThrow();
    });

    it("handles long password", async () => {
      const longPwd = "a".repeat(100);
      const hash = await PasswordUtils.hash(longPwd);
      const result = await PasswordUtils.verify(longPwd, hash);

      expect(result).toBe(true);
    });
  });
});
