import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: [
    "./domain/**/*.gql",
    "scalar DateTime\nscalar Timestamp\nscalar DateTimeOrTimestamp\nscalar Money",
  ],
  generates: {
    "./shared/infra/graphql/types/types.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
    },
  },
  config: {
    useTypeImports: true,
    scalars: {
      ID: "string",
      String: "string",
      Boolean: "boolean",
      Int: "number",
      Float: "number",
      DateTime: "Date",
      Timestamp: "number",
      DateTimeOrTimestamp: "Date",
      Money: "import('@lib/money').Money",
    },
  },
};

export default config;
