import { makeExecutableSchema } from "@graphql-tools/schema";
import { DateTimeResolver, TimestampResolver } from "graphql-scalars";
import { DateTimeOrTimestampResolver } from "./scalars/date-time-or-timestamp";
import { MoneyResolver } from "./scalars/money";
import {
  authTypeDefs,
  authResolvers,
} from "$services/domain/auth/adapters/driving/graphql/auth.resolver";
import {
  assetTypeDefs,
  assetResolvers,
} from "$services/domain/assets/adapters/driving/graphql/asset.resolver";
import {
  userTypeDefs,
  userResolvers,
} from "$services/domain/user/adapters/driving/graphql/user.resolver";
import {
  productTypeDefs,
  productResolvers,
} from "$services/domain/products/adapters/driving/graphql/product.resolver";
import {
  contactTypeDefs,
  contactResolvers,
} from "$services/domain/contacts/adapters/driving/graphql/contact.resolver";
import {
  transactionTypeDefs,
  transactionResolvers,
} from "$services/domain/transactions/adapters/driving/graphql/transaction.resolver";
import {
  settingTypeDefs,
  settingResolvers,
} from "$services/domain/setting/adapters/driving/graphql/setting.resolver";
import {
  statisticTypeDefs,
  statisticResolvers,
} from "$services/domain/statistic/adapters/driving/graphql/statistic.resolver";
import {
  orderTypeDefs,
  orderResolvers,
} from "$services/domain/order/adapters/driving/graphql/order.resolver";
import {
  paymentTypeDefs,
  paymentResolvers,
} from "$services/domain/payment/adapters/driving/graphql/payment.resolver";
import {
  adminDirectiveTypeDefs,
  authorizedDirectiveTypeDefs,
  authorizedDirectiveTransformer,
  adminDirectiveTransformer,
  killswitchTransformer,
} from "./directives";
import {
  adminTypeDefs,
  adminResolvers,
} from "$services/domain/admin/adapters/driving/graphql/admin.resolver";
import { ApolloServer } from "@apollo/server";
import { apollo } from "@elysiajs/apollo";
import { GraphQLError } from "graphql";
import {
  createContext,
  withSetCookies,
  makeCookieSetter,
} from "./yoga-context";
import type { YogaContext, CookieJar } from "./yoga-context";
import { ServiceError } from "$services/shared/kernel/errors/service-error";
import {
  depthLimitRule,
  noIntrospectionInProductionRule,
} from "./security-rules";
import { appConfigs } from "$config";
import { withResolverLogging } from "./graphql-stream";
import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

const scalarTypeDefs = `scalar DateTime
scalar Timestamp
scalar DateTimeOrTimestamp
scalar Money`;

/** Relay pagination primitives shared by every keyset paginated connection. */
const paginationTypeDefs = `type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}`;

const gqlStream = streamLog(
  Logger.create(LogLevel.Info, ".logger/graphql-resolver-log.log"),
).child("GraphQL");

const moduleResolvers = {
  Auth: authResolvers,
  Assets: assetResolvers,
  Users: userResolvers,
  Products: productResolvers,
  Contacts: contactResolvers,
  Transactions: transactionResolvers,
  Settings: settingResolvers,
  Statistics: statisticResolvers,
  Orders: orderResolvers,
  Payments: paymentResolvers,
  Admin: adminResolvers,
} as const;

let schema = makeExecutableSchema({
  typeDefs: [
    authorizedDirectiveTypeDefs,
    adminDirectiveTypeDefs,
    scalarTypeDefs,
    paginationTypeDefs,
    authTypeDefs,
    assetTypeDefs,
    userTypeDefs,
    productTypeDefs,
    contactTypeDefs,
    transactionTypeDefs,
    settingTypeDefs,
    statisticTypeDefs,
    orderTypeDefs,
    paymentTypeDefs,
    adminTypeDefs,
  ],
  resolvers: [
    {
      DateTime: DateTimeResolver,
      Timestamp: TimestampResolver,
      DateTimeOrTimestamp: DateTimeOrTimestampResolver,
      Money: MoneyResolver,
    },
    ...Object.entries(moduleResolvers).map(([name, resolvers]) =>
      withResolverLogging(gqlStream.child(name), resolvers),
    ),
  ],
});

schema = authorizedDirectiveTransformer(schema, {
  exclude: ["signIn", "signUp"],
});
schema = adminDirectiveTransformer(schema);
schema = killswitchTransformer(schema);

function formatError(formattedError: any, error: unknown) {
  const original =
    error instanceof GraphQLError
      ? error.originalError
      : error instanceof ServiceError
        ? error
        : undefined;
  if (original instanceof ServiceError) {
    return {
      ...formattedError,
      message: original.message,
      extensions: {
        ...(formattedError.extensions || {}),
        code: original.code,
        ...(process.env.NODE_ENV === "development"
          ? { stack: original.stack }
          : {}),
      },
    };
  }
  if (process.env.NODE_ENV !== "development") {
    return { ...formattedError, message: "Internal server error" };
  }
  return formattedError;
}

export const apolloServer = new ApolloServer<YogaContext>({
  schema,
  introspection: appConfigs.graphql.graphiql,
  formatError,
  validationRules: [
    ...(appConfigs.graphql.graphiql ? [] : [noIntrospectionInProductionRule()]),
    depthLimitRule(appConfigs.graphql.maxDepth),
  ],
});

export const gqlApolloAsPluginElysia = (opts: { path?: string } = {}) => {
  const path = opts.path ?? "/graphql";
  return apollo({
    path,
    server: apolloServer,
    context: async ({ request }: { request: Request }) => {
      const cookieJar: CookieJar = [];
      const cookie = makeCookieSetter(cookieJar);
      return createContext({ request, cookieJar, cookie });
    },
  });
};

// Keep backward compatibility exports
export const gqlYogaAsPluginElysia = gqlApolloAsPluginElysia;
export const yogaFetch = async (request: Request): Promise<Response> => {
  const cookieJar: CookieJar = [];
  const cookie = makeCookieSetter(cookieJar);
  const context = await createContext({ request, cookieJar, cookie });
  const response = await apolloServer.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method === "POST" ? await request.text() : undefined,
      search: new URL(request.url).search,
    },
    context: async () => context,
  });
  if (!response.body) {
    return withSetCookies(
      new Response(null, { status: response.status || 200 }),
      cookieJar,
    );
  }
  const text = await response.body;
  return withSetCookies(
    new Response(text, {
      status: response.status || 200,
      headers: response.headers,
    }),
    cookieJar,
  );
};
export { apolloServer as yoga };
