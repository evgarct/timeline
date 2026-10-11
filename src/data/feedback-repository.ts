import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { database } from "@/db/client";
import { agentFeedback } from "@/db/schema";
import {
  FEEDBACK_DEDUPE_WINDOW_MS,
  FEEDBACK_RATE_LIMIT_PER_HOUR,
  feedbackCreateSchema,
  feedbackSchema,
  feedbackUpdateSchema,
  normalizeFeedbackSummary,
  type Feedback,
  type FeedbackFilter,
  type FeedbackInput,
  type FeedbackUpdate
} from "@/domain/feedback";

interface MemoryFeedback extends Feedback {
  userId: string;
}

const memoryFeedback: MemoryFeedback[] = [];
const useMemory = process.env.E2E_DEMO_MODE === "true" || !database;
const HOUR_MS = 60 * 60 * 1000;

function fromRow(row: typeof agentFeedback.$inferSelect): Feedback {
  return feedbackSchema.parse({
    id: row.id,
    category: row.category,
    severity: row.severity ?? undefined,
    tool: row.tool ?? undefined,
    summary: row.summary,
    details: row.details ?? undefined,
    expected: row.expected ?? undefined,
    suggestion: row.suggestion ?? undefined,
    toolCalls: row.toolCalls ?? undefined,
    source: row.source,
    client: row.client ?? undefined,
    page: row.page ?? undefined,
    status: row.status,
    resolution: row.resolution ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

function stripOwner(entry: MemoryFeedback): Feedback {
  const copy: Partial<MemoryFeedback> = { ...entry };
  delete copy.userId;
  return copy as Feedback;
}

/**
 * Stores one piece of agent feedback. The same summary about the same tool within 24 hours returns the existing
 * entry (`duplicate: true`) so a retrying agent does not file it twice; more than 30 entries an hour throws
 * `rate_limited` so a looping agent cannot flood the inbox.
 */
export async function createFeedback(userId: string, rawInput: FeedbackInput): Promise<{ feedback: Feedback; duplicate: boolean }> {
  const input = feedbackCreateSchema.parse(rawInput);
  const now = new Date();
  const dedupeKey = (summary: string, tool?: string | null) => `${normalizeFeedbackSummary(summary)}|${tool ?? ""}`;
  const wanted = dedupeKey(input.summary, input.tool);

  if (useMemory || !database) {
    const own = memoryFeedback.filter((entry) => entry.userId === userId);
    const duplicate = own.find((entry) => now.getTime() - entry.createdAt.getTime() < FEEDBACK_DEDUPE_WINDOW_MS && dedupeKey(entry.summary, entry.tool) === wanted);
    if (duplicate) return { feedback: stripOwner(duplicate), duplicate: true };
    if (own.filter((entry) => now.getTime() - entry.createdAt.getTime() < HOUR_MS).length >= FEEDBACK_RATE_LIMIT_PER_HOUR) throw new Error("rate_limited");
    const created: MemoryFeedback = { ...input, id: randomUUID(), userId, status: "new", createdAt: now, updatedAt: now };
    memoryFeedback.push(created);
    return { feedback: stripOwner(created), duplicate: false };
  }

  const recent = await database.select().from(agentFeedback).where(and(
    eq(agentFeedback.userId, userId), gte(agentFeedback.createdAt, new Date(now.getTime() - FEEDBACK_DEDUPE_WINDOW_MS))
  )).orderBy(desc(agentFeedback.createdAt));
  const duplicate = recent.find((row) => dedupeKey(row.summary, row.tool) === wanted);
  if (duplicate) return { feedback: fromRow(duplicate), duplicate: true };
  if (recent.filter((row) => now.getTime() - row.createdAt.getTime() < HOUR_MS).length >= FEEDBACK_RATE_LIMIT_PER_HOUR) throw new Error("rate_limited");

  const [row] = await database.insert(agentFeedback).values({
    userId,
    category: input.category,
    severity: input.severity,
    tool: input.tool,
    summary: input.summary,
    details: input.details,
    expected: input.expected,
    suggestion: input.suggestion,
    toolCalls: input.toolCalls,
    source: input.source,
    client: input.client,
    page: input.page
  }).returning();
  return { feedback: fromRow(row), duplicate: false };
}

/** Newest first. Without a status filter every status is returned. */
export async function listFeedback(userId: string, filter: FeedbackFilter = {}): Promise<Feedback[]> {
  const limit = Math.min(200, Math.max(1, filter.limit ?? 50));
  if (useMemory || !database) {
    return memoryFeedback
      .filter((entry) => entry.userId === userId
        && (!filter.status || entry.status === filter.status)
        && (!filter.category || entry.category === filter.category)
        && (!filter.tool || entry.tool === filter.tool))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(stripOwner);
  }
  const rows = await database.select().from(agentFeedback).where(and(
    eq(agentFeedback.userId, userId),
    filter.status ? eq(agentFeedback.status, filter.status) : undefined,
    filter.category ? eq(agentFeedback.category, filter.category) : undefined,
    filter.tool ? eq(agentFeedback.tool, filter.tool) : undefined
  )).orderBy(desc(agentFeedback.createdAt)).limit(limit);
  return rows.map(fromRow);
}

export async function getFeedback(userId: string, id: string): Promise<Feedback | undefined> {
  if (useMemory || !database) {
    const found = memoryFeedback.find((entry) => entry.userId === userId && entry.id === id);
    return found ? stripOwner(found) : undefined;
  }
  const [row] = await database.select().from(agentFeedback).where(and(eq(agentFeedback.userId, userId), eq(agentFeedback.id, id))).limit(1);
  return row ? fromRow(row) : undefined;
}

export async function updateFeedback(userId: string, id: string, rawPatch: FeedbackUpdate): Promise<Feedback | undefined> {
  const patch = feedbackUpdateSchema.parse(rawPatch);
  const now = new Date();
  if (useMemory || !database) {
    const found = memoryFeedback.find((entry) => entry.userId === userId && entry.id === id);
    if (!found) return undefined;
    if (patch.status) found.status = patch.status;
    if (patch.resolution !== undefined) found.resolution = patch.resolution;
    found.updatedAt = now;
    return stripOwner(found);
  }
  const [row] = await database.update(agentFeedback).set({
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.resolution !== undefined ? { resolution: patch.resolution } : {}),
    updatedAt: now
  }).where(and(eq(agentFeedback.userId, userId), eq(agentFeedback.id, id))).returning();
  return row ? fromRow(row) : undefined;
}

export async function countFeedback(userId: string, status?: FeedbackFilter["status"]): Promise<number> {
  if (useMemory || !database) {
    return memoryFeedback.filter((entry) => entry.userId === userId && (!status || entry.status === status)).length;
  }
  const [row] = await database.select({ total: count() }).from(agentFeedback).where(and(
    eq(agentFeedback.userId, userId), status ? eq(agentFeedback.status, status) : undefined
  ));
  return row?.total ?? 0;
}
