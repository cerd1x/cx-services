import { printSchema } from "graphql";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { schema } from "../shared/infra/graphql/yoga-server";

const outDir = resolve(process.cwd(), ".tmp");
mkdirSync(outDir, { recursive: true });
const sdl = printSchema(schema);
writeFileSync(resolve(outDir, "schema.graphql"), sdl);
console.log("Generated .tmp/schema.graphql");
