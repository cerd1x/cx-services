import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { User } from "../../../../user/core/model/user.model";
import typeDefs from "./auth.gql?raw";
import type { Resolvers } from "$services/shared/infra/graphql/types";
import { appConfigs } from "$config";

const RP_NAME = "cxapp";

function getRpContext(request: Request): { rpID: string; origin: string } {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") ?? appConfigs.app.origin;
  return { rpID: url.hostname, origin };
}

function parseJsonObject<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

const resolvers: Resolvers<YogaContext> = {
  Query: {
    me: async (_parent, _args, { user, userAuth }) => {
      if (!userAuth) throw new Error("Unauthorized");
      const result = await user.user(userAuth.id);
      return {
        id: result.idHash,
        name: result.name,
        username: result.username,
        avatarUrl: result.avatarUrl ?? null,
      };
    },
    checkAuthorized: (_parent, _args, { userAuth }) => userAuth !== null,
    passkeyRegistrationOptions: async (_parent, _args, { auth, userAuth, request }) => {
      if (!userAuth) throw new Error("Unauthorized");
      const { rpID } = getRpContext(request);
      const result = await auth.passkeyRegistrationOptions({
        userId: userAuth.id.toNumb,
        rpID,
        rpName: RP_NAME,
      });
      return {
        options: JSON.stringify(result.options),
        challenge: result.challenge,
      };
    },
    passkeyAuthenticationOptions: async (_parent, _args, { auth, request }) => {
      const { rpID } = getRpContext(request);
      const result = await auth.passkeyAuthenticationOptions({ rpID });
      return {
        options: JSON.stringify(result.options),
        challenge: result.challenge,
      };
    },
    passkeys: async (_parent, _args, { auth, userAuth }) => {
      if (!userAuth) throw new Error("Unauthorized");
      const list = await auth.listPasskeys(userAuth.id.toNumb);
      return list.map((passkey) => ({
        id: passkey.credentialId,
        deviceName: passkey.deviceName,
        createdAt: new Date(passkey.createdAt),
      }));
    },
  },
  Mutation: {
    signUp: async (_parent, args, { auth, cookie }) => {
      const user = User.new({
        name: args.input.name,
        username: args.input.username,
        email: "",
        password: args.input.password,
      });

      const result = await auth.signUp(user);

      cookie[appConfigs.cookie.sessionKey]?.set({
        value: result.session,
        maxAge: appConfigs.cookie.sessionMaxAge,
      });
      cookie[appConfigs.cookie.refreshKey]?.set({
        value: result.refreshToken,
        maxAge: appConfigs.cookie.refreshMaxAge,
      });

      return {
        user: {
          id: result.user.id?.toHash ?? "",
          name: user.name,
          username: user.username,
        },
        session: result.session,
        refreshToken: result.refreshToken,
      };
    },

    signIn: async (_parent, args, { auth, cookie }) => {
      const result = await auth.signIn(args.input.username, args.input.password);

      cookie[appConfigs.cookie.sessionKey]?.set({
        value: result.session,
        maxAge: appConfigs.cookie.sessionMaxAge,
      });
      cookie[appConfigs.cookie.refreshKey]?.set({
        value: result.refreshToken,
        maxAge: appConfigs.cookie.refreshMaxAge,
      });

      return {
        user: {
          id: result.user.id?.toHash ?? "",
          name: result.user.name,
          username: result.user.username,
        },
        session: result.session,
        refreshToken: result.refreshToken,
      };
    },

    signInWithPassKey: async (_parent, args, { auth, cookie, request }) => {
      const { rpID, origin } = getRpContext(request);
      const result = await auth.signInWithPassKey({
        challenge: args.input.challenge,
        credentialId: args.input.credentialId,
        assertionResponse: parseJsonObject(args.input.assertionResponse),
        origin,
        rpID,
      });

      cookie[appConfigs.cookie.sessionKey]?.set({
        value: result.session,
        maxAge: appConfigs.cookie.sessionMaxAge,
      });
      cookie[appConfigs.cookie.refreshKey]?.set({
        value: result.refreshToken,
        maxAge: appConfigs.cookie.refreshMaxAge,
      });

      return {
        user: {
          id: result.user.id?.toHash ?? "",
          name: result.user.name,
          username: result.user.username,
        },
        session: result.session,
        refreshToken: result.refreshToken,
      };
    },

    registerPasskey: async (_parent, args, { auth, userAuth, request }) => {
      if (!userAuth) throw new Error("Unauthorized");
      const { rpID, origin } = getRpContext(request);
      await auth.registerPasskey({
        userId: userAuth.id.toNumb,
        challenge: args.input.challenge,
        attestationResponse: parseJsonObject(args.input.attestationResponse),
        origin,
        rpID,
        deviceName: args.input.deviceName ?? undefined,
      });
      return true;
    },

    deletePasskey: async (_parent, args, { auth, userAuth }) => {
      if (!userAuth) throw new Error("Unauthorized");
      return auth.deletePasskey(userAuth.id.toNumb, args.credentialId);
    },

    signOut: async (_parent, _args, { auth, cookie, cookies }) => {
      const session = cookies[appConfigs.cookie.sessionKey];
      const refreshToken = cookies[appConfigs.cookie.refreshKey];

      if (session) {
        await auth.signOut(session, refreshToken ?? undefined);
      }

      cookie[appConfigs.cookie.sessionKey]?.set({
        value: "",
        maxAge: 0,
        path: "/",
      });
      cookie[appConfigs.cookie.refreshKey]?.set({
        value: "",
        maxAge: 0,
        path: "/",
      });

      return true;
    },
  },
};

export { typeDefs as authTypeDefs };
export const authResolvers = resolvers;
