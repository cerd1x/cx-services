import type { Resolvers } from "$gql/types.generated";
import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import typeDefs from "./setting.gql?raw";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    setting: async (_parent, _args, { setting, userAuth }) => {
      if (!userAuth) throw new AuthenticationError("Not authenticated");
      const result = await setting.settingByUserId(userAuth.id.toNumb);

      return {
        id: String(result.id),
        userId: String(result.userId),
        currency: result.currency,
        darkMode: result.darkMode,
        dateFormat: result.dateFormat,
      };
    },
  },
  Mutation: {
    updateSetting: async (_parent, args, { setting, userAuth }) => {
      if (!userAuth) throw new AuthenticationError("Not authenticated");

      const input: { currency?: string; darkMode?: boolean; dateFormat?: string } = {};
      if (args.input.currency != null) input.currency = args.input.currency;
      if (args.input.darkMode != null) input.darkMode = args.input.darkMode;
      if (args.input.dateFormat != null) input.dateFormat = args.input.dateFormat;

      const result = await setting.updateSetting(userAuth.id.toNumb, input);

      return {
        id: String(result.id),
        userId: String(result.userId),
        currency: result.currency,
        darkMode: result.darkMode,
        dateFormat: result.dateFormat,
      };
    },
  },
};

export { typeDefs as settingTypeDefs };
export const settingResolvers = resolvers;
