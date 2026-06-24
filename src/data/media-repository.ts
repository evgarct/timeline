import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { database } from "@/db/client";
import { mediaAssets } from "@/db/schema";

export type MediaAsset = typeof mediaAssets.$inferSelect;

const useMemory = process.env.E2E_DEMO_MODE === "true";
const memoryAssets: MediaAsset[] = [];

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
  if (useMemory) {
    const now = new Date();
    const asset = {
      ...input,
      eventId: null,
      thumbnailObjectKey: input.thumbnailObjectKey ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      thumbnailSizeBytes: input.thumbnailSizeBytes ?? null,
      status: "pending",
      createdAt: now,
      updatedAt: now
    } satisfies MediaAsset;
    memoryAssets.push(asset);
    return asset;
  }
  const [asset] = await requireDatabase().insert(mediaAssets).values(input).returning();
  return asset;
}

export async function getMediaAsset(userId: string, id: string) {
  if (useMemory) return memoryAssets.find((asset) => asset.userId === userId && asset.id === id) ?? null;
  if (!database) return null;
  const [asset] = await database.select().from(mediaAssets)
    .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.id, id)))
    .limit(1);
  return asset ?? null;
}

export async function getMediaAssets(userId: string, ids: string[]) {
  if (useMemory) return memoryAssets.filter((asset) => asset.userId === userId && ids.includes(asset.id));
  if (!database || !ids.length) return [];
  return database.select().from(mediaAssets)
    .where(and(eq(mediaAssets.userId, userId), inArray(mediaAssets.id, ids)));
}

export async function markMediaAssetReady(userId: string, id: string) {
  if (useMemory) {
    const asset = memoryAssets.find((item) => item.userId === userId && item.id === id && item.status === "pending");
    if (!asset) return null;
    asset.status = "ready";
    asset.updatedAt = new Date();
    return asset;
  }
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
  if (useMemory) {
    const now = new Date();
    for (const asset of memoryAssets) {
      if (asset.userId === userId && asset.status === "ready" && ids.includes(asset.id)) {
        asset.eventId = eventId;
        asset.updatedAt = now;
      }
    }
    return;
  }
  await requireDatabase().update(mediaAssets)
    .set({ eventId, updatedAt: new Date() })
    .where(and(
      eq(mediaAssets.userId, userId),
      eq(mediaAssets.status, "ready"),
      inArray(mediaAssets.id, ids)
    ));
}

export async function markEventMediaDeleting(userId: string, eventId: string) {
  if (useMemory) {
    const now = new Date();
    const assets = memoryAssets.filter((asset) => asset.userId === userId && asset.eventId === eventId);
    for (const asset of assets) {
      asset.status = "deleting";
      asset.updatedAt = now;
    }
    return assets;
  }
  if (!database) return [];
  return database.update(mediaAssets)
    .set({ status: "deleting", updatedAt: new Date() })
    .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.eventId, eventId)))
    .returning();
}

export async function listCleanupMedia(cutoff: Date) {
  if (useMemory) {
    return memoryAssets.filter((asset) => (
      (["pending", "deleting"].includes(asset.status) || (asset.status === "ready" && !asset.eventId))
      && asset.updatedAt < cutoff
    ));
  }
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
  if (useMemory) {
    for (let index = memoryAssets.length - 1; index >= 0; index -= 1) {
      const asset = memoryAssets[index];
      if (asset && ids.includes(asset.id)) memoryAssets.splice(index, 1);
    }
    return;
  }
  if (!database || !ids.length) return;
  await database.delete(mediaAssets).where(inArray(mediaAssets.id, ids));
}

export async function getMediaStorageUsedBytes(userId: string) {
  if (useMemory) {
    return memoryAssets
      .filter((asset) => asset.userId === userId && ["pending", "ready"].includes(asset.status))
      .reduce((total, asset) => total + asset.sizeBytes + (asset.thumbnailSizeBytes ?? 0), 0);
  }
  if (!database) return 0;
  const [row] = await database
    .select({
      usedBytes: sql<string | number>`coalesce(sum(${mediaAssets.sizeBytes} + coalesce(${mediaAssets.thumbnailSizeBytes}, 0)), 0)`
    })
    .from(mediaAssets)
    .where(and(
      eq(mediaAssets.userId, userId),
      inArray(mediaAssets.status, ["pending", "ready"])
    ));
  return coerceStorageBytes(row?.usedBytes);
}

function coerceStorageBytes(value: string | number | undefined) {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  const bytes = BigInt(value);
  return bytes > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(bytes);
}
