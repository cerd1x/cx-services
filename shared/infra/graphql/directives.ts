import { mapSchema, MapperKind, getDirective } from "@graphql-tools/utils";
import { defaultFieldResolver, type GraphQLSchema, type ResponsePath } from "graphql";
import {
  AuthenticationError,
  UnauthorizedError,
} from "$services/shared/kernel/errors/service-error";
import {
  buildOperationKey,
  ApiDisabledError,
} from "$services/domain/killswitch/core/model/api-killswitch.model";
import type { ApiKillswitchService } from "$services/domain/killswitch";
import type { UserRole } from "$services/domain/user";

export const authorizedDirectiveTypeDefs = /* sdl */ `
  directive @authorized on OBJECT | FIELD_DEFINITION
`;

export const adminDirectiveTypeDefs = /* sdl */ `
  directive @admin on OBJECT | FIELD_DEFINITION
`;

/** Bentuk `context.userAuth` yang dipakai kedua transformer otorisasi. */
type AuthContext = {
  userAuth: { id: unknown; username: string; role: UserRole } | null;
};

/**
 * Error otorisasi sengaja dilempar sebagai `ServiceError`, bukan `GraphQLError`.
 *
 * `maskedErrors` di `yoga-server.ts` hanya meneruskan message dan code untuk
 * `ServiceError`; `GraphQLError` yang dilempar langsung akan dibuang jadi
 * `"Internal server error"` tanpa code — sehingga client tidak bisa membedakan
 * "belum login" dari "kegagalan server".
 */
function unauthenticatedError(): AuthenticationError {
  return new AuthenticationError("Missing or expired token");
}

function forbiddenError(): UnauthorizedError {
  return new UnauthorizedError("Forbidden: admin role required");
}

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

          const { userAuth } = context as AuthContext;
          if (!userAuth) {
            throw unauthenticatedError();
          }

          return originalResolve(source, args, context, info);
        };
      }
      return fieldConfig;
    },
  });
}

/**
 * Membatasi field ke user dengan peran admin.
 *
 * Berbeda dengan `@authorized` yang hanya memeriksa "ada token tidak", `@admin`
 * memeriksa token **dan** `role`. Field bertanda `@admin` boleh tetap memakai
 * `@authorized` sekaligus; urutan transformer membuat pemeriksaan `@admin` yang
 * lebih dulu berjalan, jadi anonymous mendapat 401 (bukan 403) dan user biasa
 * mendapat 403.
 *
 * Sumber kebenaran adalah `context.userAuth.role`, yang diambil dari database
 * saat token diverifikasi di `createContext` — bukan dari klaim di dalam JWT.
 * Jadi mencabut akses admin berlaku segera, tanpa menunggu token kedaluwarsa.
 */
export function adminDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const adminDirective = getDirective(schema, fieldConfig, "admin")?.[0];

      if (adminDirective) {
        const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;

        fieldConfig.resolve = async (source, args, context, info) => {
          const { userAuth } = context as AuthContext;
          if (!userAuth) {
            throw unauthenticatedError();
          }

          if (userAuth.role !== "admin") {
            throw forbiddenError();
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
