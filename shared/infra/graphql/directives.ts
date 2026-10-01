import { mapSchema, MapperKind, getDirective } from "@graphql-tools/utils";
import { defaultFieldResolver, type GraphQLSchema, type ResponsePath, GraphQLError } from "graphql";

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
