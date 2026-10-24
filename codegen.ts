import type { CodegenConfig } from "@graphql-codegen/cli";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ISO_CURRENCIES } from "./lib/money/data/iso";

const isoCurrencyEnum = `enum IsoCurrency {\n  ${ISO_CURRENCIES.map((c) => c.isoAlphaCode).join("\n  ")}\n}\n`;

const sdlPath = resolve(import.meta.dirname, "shared/infra/graphql/iso-currency.gql");
writeFileSync(sdlPath, isoCurrencyEnum);

const config: CodegenConfig = {
  schema: [
    "./domain/**/*.gql",
    "./shared/infra/graphql/iso-currency.gql",
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
