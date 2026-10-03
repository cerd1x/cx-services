import { makeExecutableSchema } from "@graphql-tools/schema";
import { DateTimeResolver, TimestampResolver } from "graphql-scalars";
import { DateTimeOrTimestampResolver } from "./scalars/date-time-or-timestamp";
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
  authorizedDirectiveTypeDefs,
  authorizedDirectiveTransformer,
  killswitchTransformer,
} from "./directives";
import { createYoga, createGraphQLError, type YogaServerOptions } from "graphql-yoga";
import { GraphQLError } from "graphql";
import { createContext, withSetCookies } from "./yoga-context";
import type { YogaContext, CookieJar } from "./yoga-context";
import { ServiceError } from "$services/shared/kernel/errors/service-error";
import type { Elysia } from "elysia";
import { depthLimitRule, noIntrospectionInProductionRule } from "./security-rules";
import { appConfigs } from "$config";
import { withResolverLogging } from "./graphql-stream";
import { Logger, LogLevel, streamLog } from "$services/shared/infra/logger";

const scalarTypeDefs = `scalar DateTime
scalar Timestamp
scalar DateTimeOrTimestamp`;

/** Relay pagination primitives shared by every keyset paginated connection. */
const paginationTypeDefs = `type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}`;

const gqlStream = streamLog(Logger.create(LogLevel.Info, ".logger/graphql-resolver-log.log")).child(
  "GraphQL",
);

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
} as const;

let schema = makeExecutableSchema({
  typeDefs: [
    authorizedDirectiveTypeDefs,
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
  ],
  resolvers: [
    {
      DateTime: DateTimeResolver,
      Timestamp: TimestampResolver,
      DateTimeOrTimestamp: DateTimeOrTimestampResolver,
    },
    ...Object.entries(moduleResolvers).map(([name, resolvers]) =>
      withResolverLogging(gqlStream.child(name), resolvers),
    ),
  ],
});

schema = authorizedDirectiveTransformer(schema, { exclude: ["signIn", "signUp"] });

// Applied setelah `authorizedDirectiveTransformer` supaya kill switch jadi
// wrapper terluar: operation yang dimatikan berhenti di sini, sebelum resolver
// dan sebelum pemeriksaan auth.
schema = killswitchTransformer(schema);

const yoga = createYoga<YogaContext, YogaContext>({
  schema,
  context: (ctx) => createContext(ctx),
  cors: false,
  logging: false,
  graphiql: process.env.NODE_ENV === "development",
  fetchAPI: { Response },
  plugins: [
    {
      onValidate({
        addValidationRule,
      }: {
        addValidationRule: (rule: import("graphql").ValidationRule) => void;
      }) {
        if (process.env.NODE_ENV !== "development") {
          addValidationRule(noIntrospectionInProductionRule());
        }
        addValidationRule(depthLimitRule(appConfigs.graphql.maxDepth));
      },
    },
  ],
  maskedErrors: {
    isDev: process.env.NODE_ENV === "development",
    errorMessage: "Internal server error",
    maskError(raw, message, isDev) {
      const original =
        raw instanceof GraphQLError
          ? raw.originalError
          : raw instanceof ServiceError
            ? raw
            : undefined;
      if (original instanceof ServiceError) {
        return createGraphQLError(original.message, {
          extensions: { code: original.code, ...(isDev ? { stack: original.stack } : {}) },
        });
      }
      if (isDev && raw instanceof Error) return raw;
      return new Error(message);
    },
  },
});

const _yogaFetch = yoga.fetch.bind(yoga) as (
  request: Request,
  extra?: Record<string, unknown>,
) => Response | Promise<Response>;

/**
 * Satu-satunya pintu masuk ke `yoga.fetch()`.
 *
 * `CookieJar` dibuat di sini lalu diteruskan sebagai serverContext supaya
 * `createContext` bisa menulis cookie ke sana; setelah response selesai, isinya
 * ditulis sebagai header `Set-Cookie`.
 */
async function runYoga(request: Request, extra?: Record<string, unknown>): Promise<Response> {
  const cookieJar: CookieJar = [];
  const response = await _yogaFetch(request, { ...extra, cookieJar });
  return withSetCookies(response, cookieJar);
}

export function yogaFetch(
  request: Request,
  extra?: Record<string, unknown>,
): Promise<Response> | Response {
  return runYoga(request, extra ?? {});
}

type GqlYogaPluginOptions = {
  path?: string;
  cors?: YogaServerOptions<YogaContext, YogaContext>["cors"];
  logging?: boolean;
};

export const gqlYogaAsPluginElysia = (opts: GqlYogaPluginOptions = {}) => {
  const path = opts.path ?? "/graphql";

  return (app: Elysia) =>
    app
      .get(path, async ({ request }: any) => {
        // Teruskan Response yoga apa adanya: Content-Type GraphiQL (text/html)
        // harus dipertahankan, dan body tidak boleh di-buffer.
        return runYoga(request);
      })
      .post(
        path,
        async ({ request, body }: any) => {
          // `aot: false` memakai dynamic-handle Elysia yang TIDAK menghormati
          // `parse: "none"`: hook parse `none` dilewati, lalu fallback
          // `switch (contentType)` tetap menjalankan `request.json()`, sehingga
          // stream body terkunci dan yoga gagal dengan
          // "This ReadableStream is currently locked to a reader.".
          // Solusinya: kirim Request baru ke yoga dari body yang sudah di-parse.
          const payload = request.bodyUsed
            ? typeof body === "string"
              ? body
              : body === undefined
                ? ""
                : JSON.stringify(body)
            : await request.text();
          const res = await runYoga(
            new Request(request.url, {
              method: "POST",
              headers: request.headers,
              body: payload,
            }),
          );
          return res;
        },
        { parse: "none" },
      );
};

export { yoga };
