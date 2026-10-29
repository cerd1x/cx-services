import type { Resolvers } from "$gql/types.generated";
import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { AuthenticationError } from "$services/shared/kernel/errors/service-error";
import { ID } from "$services/shared/kernel";
import typeDefs from "./setting.gql?raw";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    setting: async (_parent, _args, { setting, userAuth }) => {
      if (!userAuth) throw new AuthenticationError("Not authenticated");
      const result = await setting.settingByUserId(userAuth.id.decode);

      return {
        id: result.id !== undefined ? ID.setting(result.id).str : "",
        userId: result.userId !== undefined ? ID.user(result.userId).str : "",
        currency: result.currency,
        darkMode: result.darkMode,
        dateFormat: result.dateFormat,
        defaultAssetCashId:
          result.defaultAssetCashId != null ? ID.asset(result.defaultAssetCashId).str : null,
      };
    },
  },
  Mutation: {
    updateSetting: async (_parent, args, { setting, userAuth }) => {
      if (!userAuth) throw new AuthenticationError("Not authenticated");

      const input: {
        currency?: string;
        darkMode?: boolean;
        dateFormat?: string;
        defaultAssetCashId?: number;
      } = {};
      if (args.input.currency != null) input.currency = args.input.currency;
      if (args.input.darkMode != null) input.darkMode = args.input.darkMode;
      if (args.input.dateFormat != null) input.dateFormat = args.input.dateFormat;
      if (args.input.defaultAssetCashId != null) {
        input.defaultAssetCashId = ID.new(args.input.defaultAssetCashId).decode;
      }

      const result = await setting.updateSetting(userAuth.id.decode, input);

      return {
        id: result.id !== undefined ? ID.setting(result.id).str : "",
        userId: result.userId !== undefined ? ID.user(result.userId).str : "",
        currency: result.currency,
        darkMode: result.darkMode,
        dateFormat: result.dateFormat,
        defaultAssetCashId:
          result.defaultAssetCashId != null ? ID.asset(result.defaultAssetCashId).str : null,
      };
    },
  },
};

export { typeDefs as settingTypeDefs };
export const settingResolvers = resolvers;
