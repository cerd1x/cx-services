import type { YogaContext } from "$services/shared/infra/graphql/yoga-context";
import { User } from "../../../../user/core/model/user.model";
import typeDefs from "./auth.gql?raw";
import type { Resolvers } from "$services/shared/infra/graphql/types";
import { appConfigs } from "$config";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";

const RP_NAME = "cxapp";

function getRpContext(request: Request): { rpID: string; origin: string } {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") ?? appConfigs.app.origin;
  return { rpID: url.hostname, origin };
}

// Zod schemas for WebAuthn JSON structures
const authenticationResponseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.string().optional(),
});

const attestationResponseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    transports: z.array(z.string()).optional(),
  }),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.string().optional(),
});

function parseJsonObject<T>(raw: string, schema: z.ZodType<T>): T {
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid JSON structure: ${result.error.message}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof Error) throw error;
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
    passkeyRegistrationOptions: async (
      _parent,
      _args,
      { auth, userAuth, request },
    ) => {
      if (!userAuth) throw new Error("Unauthorized");
      const { rpID } = getRpContext(request);
      const result = await auth.passkeyRegistrationOptions({
        userId: userAuth.id.decode,
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
      const list = await auth.listPasskeys(userAuth.id.decode);
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
          id: result.user.id?.str ?? "",
          name: user.name,
          username: user.username,
        },
        session: result.session,
        refreshToken: result.refreshToken,
      };
    },

    signIn: async (_parent, args, { auth, cookie }) => {
      const result = await auth.signIn(
        args.input.username,
        args.input.password,
      );

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
          id: result.user.id?.str ?? "",
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
        assertionResponse: parseJsonObject(
          args.input.assertionResponse,
          authenticationResponseSchema,
        ) as unknown as AuthenticationResponseJSON,
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
          id: result.user.id?.str ?? "",
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
        userId: userAuth.id.decode,
        challenge: args.input.challenge,
        attestationResponse: parseJsonObject(
          args.input.attestationResponse,
          attestationResponseSchema,
        ) as unknown as RegistrationResponseJSON,
        origin,
        rpID,
        deviceName: args.input.deviceName ?? undefined,
      });
      return true;
    },

    deletePasskey: async (_parent, args, { auth, userAuth }) => {
      if (!userAuth) throw new Error("Unauthorized");
      return auth.deletePasskey(userAuth.id.decode, args.credentialId);
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
