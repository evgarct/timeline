import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { database } from "@/db/client";
import { mediaAssets } from "@/db/schema";

export type MediaAsset = typeof mediaAssets.$inferSelect;

function requireDatabase() {
  if (!database) throw new Error("Database is not configured");
  return database;
}

export async function createPendingMediaAsset(input: {
  id: string;
  userId: string;
  kind: "progress_photo" | "inbody";
  objectKey: string;
  thumbnailObjectKey?: string;
  mimeType: string;
  originalFileName: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  thumbnailSizeBytes?: number;
}) {
  const [asset] = await requireDatabase().insert(mediaAssets).values(input).returning();
  return asset;
}

export async function getMediaAsset(userId: string, id: string) {
  if (!database) return null;
  const [asset] = await database.select().from(mediaAssets)
    .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.id, id)))
    .limit(1);
  return asset ?? null;
}

export async function getMediaAssets(userId: string, ids: string[]) {
  if (!database || !ids.length) return [];
  return database.select().from(mediaAssets)
    .where(and(eq(mediaAssets.userId, userId), inArray(mediaAssets.id, ids)));
}

export async function markMediaAssetReady(userId: string, id: string) {
  const [asset] = await requireDatabase().update(mediaAssets)
    .set({ status: "ready", updatedAt: new Date() })
    .where(and(
      eq(mediaAssets.userId, userId),
      eq(mediaAssets.id, id),
      eq(mediaAssets.status, "pending")
    ))
    .returning();
  return asset ?? null;
}

export async function attachMediaAssets(userId: string, eventId: string, ids: string[]) {
  if (!ids.length) return;
  await requireDatabase().update(mediaAssets)
    .set({ eventId, updatedAt: new Date() })
    .where(and(
      eq(mediaAssets.userId, userId),
      eq(mediaAssets.status, "ready"),
      inArray(mediaAssets.id, ids)
    ));
}

export async function markEventMediaDeleting(userId: string, eventId: string) {
  if (!database) return [];
  return database.update(mediaAssets)
    .set({ status: "deleting", updatedAt: new Date() })
    .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.eventId, eventId)))
    .returning();
}

export async function listCleanupMedia(cutoff: Date) {
  if (!database) return [];
  return database.select().from(mediaAssets).where(
    and(
      or(
        inArray(mediaAssets.status, ["pending", "deleting"]),
        and(eq(mediaAssets.status, "ready"), isNull(mediaAssets.eventId))
      ),
      lt(mediaAssets.updatedAt, cutoff)
    )
  );
}

export async function deleteMediaAssetRows(ids: string[]) {
  if (!database || !ids.length) return;
  await database.delete(mediaAssets).where(inArray(mediaAssets.id, ids));
}

export async function getMediaStorageUsedBytes(userId: string) {
  if (!database) return 0;
  const [row] = await database
    .select({
      usedBytes: sql<number>`coalesce(sum(${mediaAssets.sizeBytes} + coalesce(${mediaAssets.thumbnailSizeBytes}, 0)), 0)::int`
    })
    .from(mediaAssets)
    .where(and(
      eq(mediaAssets.userId, userId),
      inArray(mediaAssets.status, ["pending", "ready"])
    ));
  return row?.usedBytes ?? 0;
}
