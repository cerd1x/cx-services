import { mock } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.SECRET_KEY ??= "test-secret-key-for-testing";
process.env.DATABASE_URL ??= ":memory:";
process.env.LOGGER_DIR ??= ".logger-file";

// Backend tidak lagi bergantung `$app/env/private`; stub ini hanya menjaga
// kompatibilitas bila ada modul yang masih mengimpornya.
mock.module("$app/env/private", () => ({
  NODE_ENV: process.env.NODE_ENV,
  SECRET_KEY: process.env.SECRET_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
}));
