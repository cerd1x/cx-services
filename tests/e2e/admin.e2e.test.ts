import { describe, expect, it } from "bun:test";
import { getD1 } from "$services/shared/infra/db";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

type AdminUserDto = {
  id: string;
  username: string;
  email: string;
  role: string;
};

type OverviewDto = {
  totalUsers: number;
  totalAdmins: number;
  totalTransactions: number;
};

/**
 * Promosi user jadi admin lewat SQL, bukan lewat `adminSetUserRole`.
 *
 * Itu justru yang mau diuji: `role` dibaca dari database setiap kali token
 * diverifikasi, jadisudnya berubah harus berlaku tanpa perlu login ulang.
 */
async function promoteToAdmin(username: string): Promise<void> {
  await getD1().prepare(`UPDATE "user" SET role = 'admin' WHERE username = ?`).bind(username).run();
}

describe("admin e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("menolak request tanpa token", async () => {
    const { errors } = await gql<{ adminUsers: AdminUserDto[] }>(`{ adminUsers { id username } }`);

    expect(errors?.[0].extensions?.code).toBe(401);
    expect(errors?.[0].message).toBe("Missing or expired token");
  });

  it("menolak user biasa dengan FORBIDDEN", async () => {
    const { session, username } = await signUpUser();

    const { errors } = await gql<{ adminUsers: AdminUserDto[] }>(
      `{ adminUsers { id username } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors?.[0].extensions?.code).toBe(403);
    expect(errors?.[0].message).toBe("Forbidden: admin role required");
    expect(username).toBeTruthy();
  });

  it("mengizinkan user yang sudah di-promosi jadi admin", async () => {
    const { session, username } = await signUpUser();
    await promoteToAdmin(username);

    const { data, errors } = await gql<{ adminUsers: AdminUserDto[] }>(
      `{ adminUsers { id username email role } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.adminUsers.some((u) => u.username === username)).toBe(true);
    expect(data!.adminUsers.find((u) => u.username === username)?.role).toBe("admin");
  });

  it("perubahan role berlaku tanpa login ulang", async () => {
    const { session, username } = await signUpUser();

    const before = await gql<{ adminUsers: AdminUserDto[] }>(
      `{ adminUsers { id } }`,
      undefined,
      authHeaders(session),
    );
    expect(before.errors?.[0].extensions?.code).toBe(403);

    await promoteToAdmin(username);

    // Token sama persis, tidak ada signIn lagi.
    const after = await gql<{ adminUsers: AdminUserDto[] }>(
      `{ adminUsers { id } }`,
      undefined,
      authHeaders(session),
    );
    expect(after.errors).toBeUndefined();
    expect(after.data!.adminUsers.length).toBeGreaterThan(0);
  });

  it("AdminUser tidak pernah membocorkan password", async () => {
    const { session, username } = await signUpUser();
    await promoteToAdmin(username);

    const { data, errors } = await gql<{ adminUsers: AdminUserDto[] }>(
      `{ adminUsers { id username email role } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    const me = data!.adminUsers.find((u) => u.username === username);
    expect(Object.keys(me ?? {})).toEqual(["id", "username", "email", "role"]);
  });

  it("adminOverview menghitung user dan admin", async () => {
    const { session, username } = await signUpUser();
    await promoteToAdmin(username);

    const { data, errors } = await gql<{ adminOverview: OverviewDto }>(
      `{ adminOverview { totalUsers totalAdmins totalTransactions } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.adminOverview.totalUsers).toBeGreaterThan(0);
    expect(data!.adminOverview.totalAdmins).toBeGreaterThan(0);
  });

  describe("adminSetUserRole", () => {
    it("menolak admin mengubah role dirinya sendiri", async () => {
      const { session, user, username } = await signUpUser();
      await promoteToAdmin(username);

      const { errors } = await gql(
        `mutation($input: AdminSetUserRoleInput!) {
          adminSetUserRole(input: $input) { id }
        }`,
        { input: { userId: user.id, role: "user" } },
        authHeaders(session),
      );

      expect(errors?.[0].message).toBe("admin cannot change their own role");
    });

    it("meng-promosi user lain", async () => {
      const admin = await signUpUser();
      await promoteToAdmin(admin.username);

      const target = await signUpUser("e2e_target_role");

      const { data, errors } = await gql<{ adminSetUserRole: { username: string } }>(
        `mutation($input: AdminSetUserRoleInput!) {
          adminSetUserRole(input: $input) { id username }
        }`,
        { input: { userId: target.user.id, role: "admin" } },
        authHeaders(admin.session),
      );

      expect(errors).toBeUndefined();
      expect(data!.adminSetUserRole.username).toBe("e2e_target_role");
    });
  });

  describe("adminDeleteUser", () => {
    it("menolak admin menghapus dirinya sendiri", async () => {
      const { session, user, username } = await signUpUser();
      await promoteToAdmin(username);

      const { errors } = await gql(
        `mutation($userId: ID!) { adminDeleteUser(userId: $userId) }`,
        { userId: user.id },
        authHeaders(session),
      );

      expect(errors?.[0].message).toBe("admin cannot delete their own account");
    });
  });

  describe("adminUserTransactions", () => {
    it("menolak limit di luar batas", async () => {
      const { session, user, username } = await signUpUser();
      await promoteToAdmin(username);

      const tooBig = await gql(
        `query($userId: ID!) { adminUserTransactions(userId: $userId, limit: 100000) { id } }`,
        { userId: user.id },
        authHeaders(session),
      );
      expect(tooBig.errors?.[0].message).toBe("limit must not exceed 200");

      const negative = await gql(
        `query($userId: ID!) { adminUserTransactions(userId: $userId, limit: 0) { id } }`,
        { userId: user.id },
        authHeaders(session),
      );
      expect(negative.errors?.[0].message).toBe("limit must be a positive integer");
    });
  });
});
