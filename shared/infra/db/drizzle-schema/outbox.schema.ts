import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const outboxTable = sqliteTable("outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  correlationId: text("correlation_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  processed: integer("processed", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
