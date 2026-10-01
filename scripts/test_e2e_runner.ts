/// <reference types="node" />
import { readdirSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const E2E_DIR = "tests/e2e";
const PRELOAD = "./tests/setup.ts";

function resolveTestName(): string {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: bun run scripts/test_e2e_runner.ts <name>");
    console.error("example: bun run scripts/test_e2e_runner.ts auth");
    process.exit(1);
  }
  return arg;
}

function findTestFiles(name: string): string[] {
  return readdirSync(E2E_DIR)
    .filter((file) => file.endsWith(".e2e.test.ts") && file.split(".")[0] === name)
    .map((file) => join(E2E_DIR, file))
    .sort();
}

const name = resolveTestName();
const files = findTestFiles(name);

if (files.length === 0) {
  console.error(`Tidak ada file e2e test dengan nama "${name}" di ${E2E_DIR}`);
  process.exit(1);
}

console.log(`Running ${files.length} e2e test file(s) for "${name}"...`);
const result = spawnSync("bun", ["test", "--preload", PRELOAD, ...files], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);