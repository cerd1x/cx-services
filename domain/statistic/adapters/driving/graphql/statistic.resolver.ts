import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import typeDefs from "./statistic.gql?raw";
import type { Resolvers } from "$services/shared/infra/graphql/types";

const resolvers: Resolvers<YogaContext> = {
  Query: {
    statistics: async (_parent, _args, { statistic, userAuth }) => {
      return statistic.getStatistic(userAuth!.id.toNumb);
    },
  },
};

export { typeDefs as statisticTypeDefs };
export const statisticResolvers = resolvers;
