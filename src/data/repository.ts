import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { database } from "@/db/client";
import { events, mcpTokens, taskSchedules } from "@/db/schema";
import { seedEvents, seedSchedules } from "./seed";
import { timelineEventSchema, type TaskSchedule, type TimelineEvent } from "@/domain/events";

const memoryEvents = [...seedEvents];
const memorySchedules = [...seedSchedules];

export async function listEvents(userId: string): Promise<TimelineEvent[]> {
  if (!database) return memoryEvents;
  const rows = await database.select().from(events).where(eq(events.userId, userId)).orderBy(desc(events.occurredAt));
  return rows.map((row) => timelineEventSchema.parse({
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt,
    timezone: row.timezone,
    note: row.note ?? undefined,
    ...(row.payload as object)
  }));
}

export async function getEvent(userId: string, id: string) {
  return (await listEvents(userId)).find((event) => event.id === id);
}

export async function createEvent(userId: string, input: TimelineEvent) {
  const event = timelineEventSchema.parse(input);
  if (!database) {
    memoryEvents.unshift(event);
    return event;
  }
  const { id, type, occurredAt, timezone, note, ...payload } = event;
  await database.insert(events).values({ id, userId, type, occurredAt, timezone, note, payload });
  return event;
}

export async function updateEvent(userId: string, input: TimelineEvent) {
  const event = timelineEventSchema.parse(input);
  if (!database) {
    const index = memoryEvents.findIndex((item) => item.id === event.id);
    if (index >= 0) memoryEvents[index] = event;
    return event;
  }
  const { id, type, occurredAt, timezone, note, ...payload } = event;
  await database
    .update(events)
    .set({ type, occurredAt, timezone, note, payload, updatedAt: new Date() })
    .where(and(eq(events.userId, userId), eq(events.id, id)));
  return event;
}

export async function deleteEvent(userId: string, id: string) {
  if (!database) {
    const index = memoryEvents.findIndex((event) => event.id === id);
    if (index >= 0) memoryEvents.splice(index, 1);
    return;
  }
  await database.delete(events).where(and(eq(events.userId, userId), eq(events.id, id)));
}

export async function listTaskSchedules(userId: string): Promise<TaskSchedule[]> {
  if (!database) return memorySchedules;
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
  if (!database) {
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
  if (!database) return tokenHash ? "demo-user" : null;
  const [row] = await database
    .select({ userId: mcpTokens.userId })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, tokenHash), isNull(mcpTokens.revokedAt)))
    .limit(1);
  return row?.userId ?? null;
}

export async function storeMcpToken(userId: string, tokenHash: string) {
  if (!database) return;
  await database.insert(mcpTokens).values({ userId, tokenHash, label: "Developer preview" });
}

