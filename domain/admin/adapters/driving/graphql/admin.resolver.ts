import { ID } from "$services/shared/kernel/id";
import { UserRole, type Resolvers } from "$services/shared/infra/graphql/types";
import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { UnauthorizedError } from "$services/shared/kernel/errors/service-error";
import typeDefs from "./admin.gql?raw";

/**
 * `UserRole` di domain adalah union string, sedangkan codegen menghasilkan TS
 * enum. Pemetaan ini satu-satunya jembatan di antara keduanya — sengaja tidak
 * `as UserRole` supaya nilai yang tak dikenal jadi error compile-time, bukan
 * string liar yang lolos ke client.
 */
function toGraphQLRole(role: string): UserRole {
  return role === "admin" ? UserRole.Admin : UserRole.User;
}

/**
 * Aktor yang sedang bertindak, diambil dari `context.userAuth`.
 *
 * Field bertanda `@admin` sudah dijamin oleh transformer, jadi `userAuth` tidak
 * mungkin null pada jalur normal. Pemeriksaan di bawah bukan pengaman hak
 * akses, melainkan agar kegagalan terjadi dekat dengan sumbernya kalau ada
 * context yang lolos tanpa transformer (mis. pemanggilan service langsung).
 */
function actorId(context: YogaContext): ID {
  if (!context.userAuth) {
    throw new UnauthorizedError("Not authenticated");
  }
  return context.userAuth.id;
}

/** `User` di SDL tidak punya `role`, jadi field `AdminUser` punya bentuk sendiri. */
function toUserPayload(user: {
  id?: { str: string };
  name: string;
  username: string;
  avatarUrl: string | null;
}) {
  return {
    id: user.id?.str ?? "",
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
  };
}

const resolvers: Resolvers<YogaContext> = {
  Query: {
    adminUsers: async (_parent, _args, { admin }) => {
      const users = await admin.users();
      return users.map((u) => ({
        ...u,
        id: ID.new(u.id).str,
        role: toGraphQLRole(u.role),
      }));
    },

    adminOverview: async (_parent, _args, { admin }) => admin.overview(),

    adminUserTransactions: async (_parent, args, { admin }) => {
      const rows = await admin.userTransactions(ID.new(args.userId), args.limit);
      return rows.map((row) => ({
        ...row,
        id: ID.new(row.id).str,
        userId: ID.new(row.userId).str,
      }));
    },
  },
  Mutation: {
    adminSetUserRole: async (_parent, args, context) => {
      const result = await context.admin.setUserRole(
        ID.new(args.input.userId),
        args.input.role,
        actorId(context),
      );
      return toUserPayload(result);
    },

    adminDeleteUser: async (_parent, args, context) =>
      context.admin.deleteUser(ID.new(args.userId), actorId(context)),
  },
};

export { typeDefs as adminTypeDefs };
export const adminResolvers = resolvers;
