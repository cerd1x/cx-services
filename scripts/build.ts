/// <reference types="bun-types" />
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Bundel `worker.ts` untuk Cloudflare Workers.
 *
 * `wrangler` (esbuild) tidak mendukung import `*.gql?raw` maupun alias
 * `$services/*`, jadi bundling dilakukan di sini dengan Bun, lalu Worker
 * dijalankan dengan `no_bundle: true`.
 */
const rootDir = process.cwd();

const aliasPlugin = {
  name: "cx-alias",
  setup(build: any) {
    build.onResolve({ filter: /^\$services\// }, (args: any) => ({
      path: resolvePath(rootDir, args.path.replace("$services/", "")),
    }));

    build.onResolve({ filter: /^\$(config|gql)(\/|$)/ }, (args: any) => {
      const sub =
        args.path === "$config" || args.path.startsWith("$config/")
          ? "app.config"
          : "shared/infra/graphql/types";
      const stripped = args.path.replace(/^\$(config|gql)/, "");
      return { path: resolvePath(rootDir, sub + stripped) };
    });

    build.onResolve({ filter: /\.gql(\?raw)?$/ }, (args: any) => {
      const importerDir = args.importer ? dirname(args.importer) : rootDir;
      const parsed = args.path.split("?")[0].split("/");
      const fileName = parsed.pop()!;
      const dir = parsed.length > 0 ? resolve(importerDir, parsed.join("/")) : importerDir;
      const found = findGqlFile(dir, fileName);
      if (!found) throw new Error(`SDL not found: ${args.path} (from ${args.importer})`);
      return { path: found, namespace: "gql-raw" };
    });

    build.onLoad({ filter: /.*/, namespace: "gql-raw" }, async (args: any) => ({
      contents: await Bun.file(args.path).text(),
      loader: "text",
    }));
  },
};

function resolvePath(base: string, sub: string): string {
  const abs = resolve(base, sub);
  if (existsSync(abs + ".ts")) return abs + ".ts";
  if (existsSync(abs + "/index.ts")) return abs + "/index.ts";
  if (existsSync(abs)) return abs;
  throw new Error(`Cannot resolve "${sub}" from "${base}"`);
}

function findGqlFile(base: string, name: string): string | null {
  for (const candidate of [resolve(base, name + ".gql"), resolve(base, name)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const NODE_BUILTINS = [
  "node:fs",
  "node:path",
  "node:os",
  "node:child_process",
  "node:crypto",
  "node:util",
  "node:stream",
  "node:buffer",
  "fs",
  "path",
  "os",
  "crypto",
];

const result = await Bun.build({
  entrypoints: ["./worker.ts"],
  target: "browser",
  outdir: "./build",
  naming: "worker.js",
  format: "esm",
  splitting: false,
  minify: false,
  sourcemap: true,
  external: NODE_BUILTINS,
  plugins: [aliasPlugin],
  root: rootDir,
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log("Build success: build/worker.js");
