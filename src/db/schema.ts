import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const eventType = pgEnum("event_type", ["progress_photo", "workout", "measurements", "inbody"]);
export const mediaKind = pgEnum("media_kind", ["progress_photo", "inbody"]);
export const mediaStatus = pgEnum("media_status", ["pending", "ready", "deleting"]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  type: eventType("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull(),
  note: text("note"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("events_user_id_id_idx").on(table.userId, table.id)
]);

export const taskSchedules = pgTable("task_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  eventType: eventType("event_type").notNull(),
  weekdays: jsonb("weekdays").$type<number[]>().notNull(),
  intervalWeeks: integer("interval_weeks").default(1).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  anchorDate: timestamp("anchor_date", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("task_schedules_user_type_idx").on(table.userId, table.eventType)
]);

export const mcpTokens = pgTable("mcp_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  eventId: uuid("event_id"),
  kind: mediaKind("kind").notNull(),
  objectKey: text("object_key").notNull().unique(),
  thumbnailObjectKey: text("thumbnail_object_key").unique(),
  mimeType: text("mime_type").notNull(),
  originalFileName: text("original_file_name").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes").notNull(),
  thumbnailSizeBytes: integer("thumbnail_size_bytes"),
  status: mediaStatus("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("media_assets_user_id_id_idx").on(table.userId, table.id)
]);

