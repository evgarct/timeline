import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { database } from "@/db/client";
import { events, mcpTokens, taskSchedules } from "@/db/schema";
import { seedEvents, seedSchedules } from "./seed";
import { timelineEventSchema, type TaskSchedule, type TimelineEvent } from "@/domain/events";
import {
  attachMediaAssets,
  deleteMediaAssetRows,
  getMediaAssets,
  markEventMediaDeleting
} from "./media-repository";
import { createDownloadUrl, deleteObjects, isR2Configured } from "@/lib/r2";

const memoryEvents = [...seedEvents];
const memorySchedules = [...seedSchedules];
const useMemory = process.env.E2E_DEMO_MODE === "true" || !database;

export async function listEvents(userId: string): Promise<TimelineEvent[]> {
  if (useMemory || !database) return memoryEvents;
  const rows = await database.select().from(events).where(eq(events.userId, userId)).orderBy(desc(events.occurredAt));
  const parsed = rows.map((row) => timelineEventSchema.parse({
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt,
    timezone: row.timezone,
    note: row.note ?? undefined,
    ...(row.payload as object)
  }));
  return Promise.all(parsed.map((event) => hydrateEventMedia(userId, event)));
}

export async function getEvent(userId: string, id: string) {
  return (await listEvents(userId)).find((event) => event.id === id);
}

export async function createEvent(userId: string, input: TimelineEvent) {
  const event = timelineEventSchema.parse(input);
  if (useMemory || !database) {
    memoryEvents.unshift(event);
    return event;
  }
  const assetIds = await validateManagedMedia(userId, event);
  const { id, type, occurredAt, timezone, note, ...payload } = stripHydratedMedia(event);
  await database.insert(events).values({ id, userId, type, occurredAt, timezone, note, payload });
  await attachMediaAssets(userId, id, assetIds);
  return hydrateEventMedia(userId, timelineEventSchema.parse(event));
}

export async function updateEvent(userId: string, input: TimelineEvent) {
  const event = timelineEventSchema.parse(input);
  if (useMemory || !database) {
    const index = memoryEvents.findIndex((item) => item.id === event.id);
    if (index >= 0) memoryEvents[index] = event;
    return event;
  }
  const assetIds = await validateManagedMedia(userId, event, event.id);
  const { id, type, occurredAt, timezone, note, ...payload } = stripHydratedMedia(event);
  await database
    .update(events)
    .set({ type, occurredAt, timezone, note, payload, updatedAt: new Date() })
    .where(and(eq(events.userId, userId), eq(events.id, id)));
  await attachMediaAssets(userId, id, assetIds);
  return hydrateEventMedia(userId, event);
}

export async function deleteEvent(userId: string, id: string) {
  if (useMemory || !database) {
    const index = memoryEvents.findIndex((event) => event.id === id);
    if (index >= 0) memoryEvents.splice(index, 1);
    return;
  }
  const assets = await markEventMediaDeleting(userId, id);
  await database.delete(events).where(and(eq(events.userId, userId), eq(events.id, id)));
  if (!assets.length) return;
  try {
    await deleteObjects(assets.flatMap((asset) => [
      asset.objectKey,
      ...(asset.thumbnailObjectKey ? [asset.thumbnailObjectKey] : [])
    ]));
    await deleteMediaAssetRows(assets.map((asset) => asset.id));
  } catch {
    // Cleanup retries objects left in the deleting state.
  }
}

function mediaAssetIds(event: TimelineEvent) {
  if (event.type === "progress_photo") {
    return event.photos.flatMap((photo) => photo.assetId ? [photo.assetId] : []);
  }
  if (event.type === "inbody" && event.source.assetId) return [event.source.assetId];
  return [];
}

async function validateManagedMedia(userId: string, event: TimelineEvent, eventId?: string) {
  if (event.type !== "progress_photo" && event.type !== "inbody") return [];
  const ids = mediaAssetIds(event);
  if (!ids.length) throw new Error("Managed media assets are required");
  if (new Set(ids).size !== ids.length) throw new Error("Media assets must be unique");
  const assets = await getMediaAssets(userId, ids);
  const expectedKind = event.type;
  if (
    assets.length !== ids.length
    || assets.some((asset) => (
      asset.kind !== expectedKind
      || asset.status !== "ready"
      || (asset.eventId && asset.eventId !== eventId)
    ))
  ) {
    throw new Error("Media asset is unavailable");
  }
  if (event.type === "inbody" && assets[0]?.mimeType !== event.source.mimeType) {
    throw new Error("Media type does not match the uploaded asset");
  }
  return ids;
}

function stripHydratedMedia(event: TimelineEvent): TimelineEvent {
  if (event.type === "progress_photo") {
    return {
      ...event,
      photos: event.photos.map((value) => {
        const photo = { ...value };
        delete photo.url;
        delete photo.thumbnailUrl;
        return photo;
      })
    };
  }
  if (event.type === "inbody") {
    const source = { ...event.source };
    delete source.url;
    return { ...event, source };
  }
  return event;
}

async function hydrateEventMedia(userId: string, event: TimelineEvent): Promise<TimelineEvent> {
  const ids = mediaAssetIds(event);
  if (!ids.length || !isR2Configured) return event;
  const assets = await getMediaAssets(userId, ids);
  const byId = new Map(assets.filter((asset) => asset.status === "ready").map((asset) => [asset.id, asset]));
  if (event.type === "progress_photo") {
    return {
      ...event,
      photos: await Promise.all(event.photos.map(async (photo) => {
        if (!photo.assetId) return photo;
        const asset = byId.get(photo.assetId);
        if (!asset) return photo;
        return {
          ...photo,
          width: asset.width ?? photo.width,
          height: asset.height ?? photo.height,
          url: await createDownloadUrl(asset.objectKey),
          thumbnailUrl: asset.thumbnailObjectKey
            ? await createDownloadUrl(asset.thumbnailObjectKey)
            : await createDownloadUrl(asset.objectKey)
        };
      }))
    };
  }
  if (event.type === "inbody" && event.source.assetId) {
    const asset = byId.get(event.source.assetId);
    if (!asset) return event;
    return {
      ...event,
      source: {
        ...event.source,
        url: `/api/media/${asset.id}`
      }
    };
  }
  return event;
}

export async function listTaskSchedules(userId: string): Promise<TaskSchedule[]> {
  if (useMemory || !database) return memorySchedules;
  const rows = await database.select().from(taskSchedules).where(eq(taskSchedules.userId, userId));
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    weekdays: row.weekdays,
    intervalWeeks: row.intervalWeeks,
    enabled: row.enabled,
    anchorDate: row.anchorDate
  }));
}

export async function saveTaskSchedule(userId: string, schedule: TaskSchedule) {
  if (useMemory || !database) {
    const index = memorySchedules.findIndex((item) => item.id === schedule.id);
    if (index >= 0) memorySchedules[index] = schedule;
    return schedule;
  }
  await database
    .insert(taskSchedules)
    .values({ ...schedule, userId })
    .onConflictDoUpdate({
      target: [taskSchedules.userId, taskSchedules.eventType],
      set: {
        weekdays: schedule.weekdays,
        intervalWeeks: schedule.intervalWeeks,
        enabled: schedule.enabled,
        anchorDate: schedule.anchorDate,
        updatedAt: new Date()
      }
    });
  return schedule;
}

export async function resolveMcpUser(tokenHash: string) {
  if (useMemory || !database) return tokenHash ? "demo-user" : null;
  const [row] = await database
    .select({ userId: mcpTokens.userId })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, tokenHash), isNull(mcpTokens.revokedAt)))
    .limit(1);
  return row?.userId ?? null;
}

export async function storeMcpToken(userId: string, tokenHash: string) {
  if (useMemory || !database) return;
  await database.insert(mcpTokens).values({ userId, tokenHash, label: "Developer preview" });
}
