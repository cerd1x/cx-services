import { ID } from "$services/shared/kernel/id";
import type { Resolvers } from "$services/shared/infra/graphql/types";
import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import typeDefs from "./user.gql?raw";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    user: async (_parent, args, { userAuth, user }) => {
      if (args.username) {
        const result = await user.userByUsername(args.username);
        return {
          id: result.id?.toHash ?? "",
          name: result.name,
          username: result.username,
          avatarUrl: result.avatarUrl,
        };
      }
      if (userAuth) {
        const result = await user.user(userAuth.id);
        return {
          id: result.id?.toHash ?? "",
          name: result.name,
          username: result.username,
          avatarUrl: result.avatarUrl,
        };
      }
      return null;
    },
    users: async (_parent, _args, { user }) => {
      const result = await user.users();
      return result.map((u) => ({
        id: u.id?.toHash ?? "",
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl,
      }));
    },
  },
  Mutation: {
    createUser: async (_parent, args, { user }) => {
      const result = await user.createUser(
        args.input.name,
        args.input.username,
        args.input.password,
        undefined,
      );
      return {
        id: result.id?.toHash ?? "",
        name: result.name,
        username: result.username,
        avatarUrl: result.avatarUrl,
      };
    },
    updateUserAvatar: async (_parent, args, { user }) => {
      const result = await user.updateUserAvatar(ID.new(args.input.userId), args.input.avatarUrl);
      return {
        id: result.id?.toHash ?? "",
        name: result.name,
        username: result.username,
        avatarUrl: result.avatarUrl,
      };
    },
  },
};

export { typeDefs as userTypeDefs };
export const userResolvers = resolvers;
