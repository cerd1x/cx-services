import { drizzle as d1Dz } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { Logger, streamLog } from "$services/shared/infra/logger";
import { relations } from "./drizzle-schema/relations";

type DBType = ReturnType<typeof d1Dz>;
let db: DBType | null = null;
let rawD1: D1Database | null = null;
export const dbLogger = streamLog(Logger.create()).child("DB");

export async function useD1(d1?: D1Database) {
  if (!d1) throw new Error("D1 binding required in production");
  rawD1 = d1;
  db = d1Dz(d1, { relations });
  dbLogger.info("Connected to D1 database");
  return db;
}

export function getDB() {
  if (!db) throw new Error("D1 not initialized. Call useD1 first.");
  return db as unknown as DBType;
}

export function setDB(drizzleInstance: unknown) {
  db = drizzleInstance as DBType;
}

export function setD1(d1: D1Database) {
  rawD1 = d1;
}

export function getD1(): D1Database {
  if (!rawD1) throw new Error("D1 not initialized. Call useD1 first.");
  return rawD1;
}
