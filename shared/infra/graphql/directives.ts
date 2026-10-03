import { mapSchema, MapperKind, getDirective } from "@graphql-tools/utils";
import { defaultFieldResolver, type GraphQLSchema, type ResponsePath, GraphQLError } from "graphql";
import {
  buildOperationKey,
  ApiDisabledError,
} from "$services/domain/killswitch/core/model/api-killswitch.model";
import type { ApiKillswitchService } from "$services/domain/killswitch";

export const authorizedDirectiveTypeDefs = /* sdl */ `
  directive @authorized on OBJECT | FIELD_DEFINITION
`;

function rootOperationName(path: ResponsePath): string {
  let current: ResponsePath | undefined = path;
  while (current?.prev) {
    current = current.prev;
  }
  return typeof current?.key === "string" ? current.key : "";
}

export function authorizedDirectiveTransformer(
  schema: GraphQLSchema,
  opts?: { exclude?: string[] },
): GraphQLSchema {
  const exclude = opts?.exclude ?? [];

  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authorizedDirective = getDirective(schema, fieldConfig, "authorized")?.[0];

      if (authorizedDirective) {
        const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;

        fieldConfig.resolve = async (source, args, context, info) => {
          if (exclude.includes(rootOperationName(info.path))) {
            return originalResolve(source, args, context, info);
          }

          const { userAuth } = context as { userAuth: { id: unknown; username: string } | null };
          if (!userAuth) {
            throw new GraphQLError("Missing or expired token", {
              extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
            });
          }

          return originalResolve(source, args, context, info);
        };
      }
      return fieldConfig;
    },
  });
}

/**
 * Mematikan root operation GraphQL secara runtime (kill switch).
 *
 * Sengaja **tanpa directive**: setiap root field otomatis bisa dimatikan, tanpa
 * perlu menambahkan anotasi di SDL. Ini penting secara operasional — saat
 * insiden, kita harus bisa mematikan API tanpa menunggu deploy, dan operation
 * yang "lupa" dianotasi justru yang paling mungkin ingin dimatikan.
 *
 * Transform ini juga membungkus `authorizedDirectiveTransformer`, sehingga
 * request ke operation yang mati berhenti di sini lebih dulu, sebelum resolver
 * dan sebelum error auth apa pun.
 *
 * **Fail-open by design.** Bila service tidak terpasang di context, atau
 * pembacaan switch melempar (D1 down, tabel belum termigrasi), operation tetap
 * dijalankan dan error dicatat. Kill switch tidak boleh bisa menjatuhkan
 * seluruh API — itu akan jadi outage sendiri.
 */
export function killswitchTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.ROOT_FIELD]: (fieldConfig, fieldName, typeName) => {
      const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;
      const operation = buildOperationKey(typeName, fieldName);

      return {
        ...fieldConfig,
        resolve: async (source, args, context, info) => {
          const service = (context as { killswitch?: ApiKillswitchService }).killswitch;
          if (!service) {
            console.warn(`[killswitch] service absent from context, allowing ${operation}`);
            return originalResolve(source, args, context, info);
          }

          try {
            const state = await service.isOperationDisabled(operation);
            if (state.disabled) {
              throw new ApiDisabledError(operation, state.reason);
            }
          } catch (error) {
            // Bedakan "sengaja dimatikan" dari kegagalan tak terduga. Keduanya
            // berakhir fail-open, tapi hanya yang pertama yang diteruskan.
            if (error instanceof ApiDisabledError) throw error;
            console.warn(`[killswitch] check failed for ${operation}, allowing:`, error);
          }

          return originalResolve(source, args, context, info);
        },
      };
    },
  });
}
