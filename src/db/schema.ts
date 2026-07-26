import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const eventType = pgEnum("event_type", ["progress_photo", "workout", "measurements", "inbody", "nutrition_entry"]);
export const mediaKind = pgEnum("media_kind", ["progress_photo", "inbody"]);
export const mediaStatus = pgEnum("media_status", ["pending", "ready", "deleting"]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  type: eventType("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull(),
  note: text("note"),
  idempotencyKey: text("idempotency_key"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("events_user_id_id_idx").on(table.userId, table.id),
  uniqueIndex("events_user_id_idempotency_key_idx").on(table.userId, table.idempotencyKey)
]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  brand: text("brand"),
  normalizedBrand: text("normalized_brand"),
  barcode: text("barcode"),
  baseUnit: text("base_unit").notNull(),
  nutrientBases: jsonb("nutrient_bases").notNull(),
  pieceSizes: jsonb("piece_sizes").notNull(),
  servingSizes: jsonb("serving_sizes").notNull().default([]),
  searchAliases: jsonb("search_aliases").notNull().default([]),
  normalizedSearchAliases: text("normalized_search_aliases"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("products_user_id_id_idx").on(table.userId, table.id),
  uniqueIndex("products_user_id_barcode_idx").on(table.userId, table.barcode)
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

export const mcpOauthClients = pgTable("mcp_oauth_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().unique(),
  clientName: text("client_name"),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
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

export const nutritionReports = pgTable("nutrition_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  reportDate: text("report_date").notNull(),
  timezone: text("timezone").notNull(),
  pdfObjectKey: text("pdf_object_key").notNull().unique(),
  ogImageObjectKey: text("og_image_object_key").notNull().unique(),
  pdfSizeBytes: integer("pdf_size_bytes").notNull(),
  ogImageSizeBytes: integer("og_image_size_bytes").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("nutrition_reports_user_id_id_idx").on(table.userId, table.id)
]);

export const storagePolicies = pgTable("storage_policies", {
  userId: text("user_id").primaryKey(),
  limitBytes: integer("limit_bytes"),
  plan: text("plan").default("default").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

