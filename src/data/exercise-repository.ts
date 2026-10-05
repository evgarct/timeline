import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { database } from "@/db/client";
import { events, exercises, workoutSets } from "@/db/schema";
import {
  exerciseInputSchema,
  estimateOneRepMaxKg,
  exerciseSchema,
  normalizeExerciseText,
  recordWorkoutSessionInputSchema,
  type Exercise,
  type ExerciseInput,
  type RecordWorkoutSessionInput,
  type WorkoutSet
} from "@/domain/exercises";
import { workoutEventSchema, type TimelineEvent } from "@/domain/events";

interface MemoryExercise extends Exercise {
  userId: string;
}
interface MemorySet extends WorkoutSet {
  userId: string;
  eventId: string;
}

const memoryExercises: MemoryExercise[] = [];
const memorySets: MemorySet[] = [];
const memoryWorkoutEvents: Array<TimelineEvent & { userId: string; idempotencyKey?: string }> = [];
const useMemory = process.env.E2E_DEMO_MODE === "true" || !database;

function exerciseFromRow(row: typeof exercises.$inferSelect): Exercise {
  return exerciseSchema.parse({
    id: row.id,
    name: row.name,
    muscleGroups: row.muscleGroups ?? undefined,
    primaryMuscles: row.primaryMuscles ?? undefined,
    secondaryMuscles: row.secondaryMuscles ?? undefined,
    movementPattern: row.movementPattern ?? undefined,
    equipment: row.equipment ?? undefined,
    isArchived: row.isArchived,
    searchAliases: row.searchAliases,
    externalRef: row.externalSource && row.externalId
      ? { source: row.externalSource, id: row.externalId }
      : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export async function searchExercises(userId: string, query = "", page = 1, pageSize = 30, includeArchived = false) {
  const normalizedQuery = normalizeExerciseText(query);
  if (useMemory || !database) {
    const matches = memoryExercises.filter((exercise) => exercise.userId === userId && (includeArchived || !exercise.isArchived) && (
      !normalizedQuery
      || normalizeExerciseText(exercise.name).includes(normalizedQuery)
      || exercise.searchAliases.some((alias) => normalizeExerciseText(alias).includes(normalizedQuery))
    ));
    const offset = (page - 1) * pageSize;
    return { items: matches.slice(offset, offset + pageSize), page, pageSize, hasMore: offset + pageSize < matches.length };
  }
  const offset = (page - 1) * pageSize;
  const scope = includeArchived
    ? eq(exercises.userId, userId)
    : and(eq(exercises.userId, userId), eq(exercises.isArchived, false));
  const condition = normalizedQuery
    ? and(
        scope,
        or(
          ilike(exercises.normalizedName, `%${normalizedQuery}%`),
          ilike(exercises.normalizedSearchAliases, `%${normalizedQuery}%`)
        )
      )
    : scope;
  const rows = await database.select().from(exercises).where(condition).orderBy(desc(exercises.updatedAt)).limit(pageSize + 1).offset(offset);
  return {
    items: rows.slice(0, pageSize).map(exerciseFromRow),
    page,
    pageSize,
    hasMore: rows.length > pageSize
  };
}

export async function getExercise(userId: string, id: string) {
  if (useMemory || !database) return memoryExercises.find((exercise) => exercise.userId === userId && exercise.id === id);
  const [row] = await database.select().from(exercises).where(and(eq(exercises.userId, userId), eq(exercises.id, id))).limit(1);
  return row ? exerciseFromRow(row) : undefined;
}

async function getExerciseByExternalRef(userId: string, source: string, externalId: string) {
  if (useMemory || !database) {
    return memoryExercises.find((exercise) => (
      exercise.userId === userId && exercise.externalRef?.source === source && exercise.externalRef.id === externalId
    ));
  }
  const [row] = await database.select().from(exercises).where(and(
    eq(exercises.userId, userId), eq(exercises.externalSource, source), eq(exercises.externalId, externalId)
  )).limit(1);
  return row ? exerciseFromRow(row) : undefined;
}

// Dedup precedence mirrors upsertProduct: explicit id, then externalRef (exact, if the caller has a
// stable third-party id), then exact normalized name — ambiguous exact-name matches are refused
// rather than guessed, same as products.
export async function upsertExercise(userId: string, rawInput: ExerciseInput) {
  const input = exerciseInputSchema.parse(rawInput);
  const normalizedName = normalizeExerciseText(input.name);
  const normalizedSearchAliases = input.searchAliases.length
    ? input.searchAliases.map(normalizeExerciseText).join(" | ")
    : undefined;
  const now = new Date();

  let existing: Exercise | undefined;
  if (input.id) existing = await getExercise(userId, input.id);
  if (!existing && input.externalRef) {
    existing = await getExerciseByExternalRef(userId, input.externalRef.source, input.externalRef.id);
  }
  if (!existing && !input.externalRef) {
    const result = await searchExercises(userId, input.name, 1, 20);
    const exact = result.items.filter((exercise) => normalizeExerciseText(exercise.name) === normalizedName);
    if (exact.length > 1) throw new Error("ambiguous_exercise");
    existing = exact[0];
  }

  const exercise = exerciseSchema.parse({
    ...input,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });

  if (useMemory || !database) {
    const index = memoryExercises.findIndex((item) => item.userId === userId && item.id === exercise.id);
    const stored = { ...exercise, userId };
    if (index >= 0) memoryExercises[index] = stored;
    else memoryExercises.unshift(stored);
    return exercise;
  }

  const values = {
    id: exercise.id,
    userId,
    name: exercise.name,
    normalizedName,
    muscleGroups: exercise.muscleGroups,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    movementPattern: exercise.movementPattern,
    equipment: exercise.equipment,
    isArchived: exercise.isArchived,
    searchAliases: exercise.searchAliases,
    normalizedSearchAliases,
    externalSource: exercise.externalRef?.source,
    externalId: exercise.externalRef?.id,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt
  };
  await database.insert(exercises).values(values).onConflictDoUpdate({
    target: exercises.id,
    set: {
      name: values.name,
      normalizedName: values.normalizedName,
      muscleGroups: values.muscleGroups,
      primaryMuscles: values.primaryMuscles,
      secondaryMuscles: values.secondaryMuscles,
      movementPattern: values.movementPattern,
      equipment: values.equipment,
      isArchived: values.isArchived,
      searchAliases: values.searchAliases,
      normalizedSearchAliases: values.normalizedSearchAliases,
      externalSource: values.externalSource,
      externalId: values.externalId,
      updatedAt: values.updatedAt
    }
  });
  return exercise;
}

type SetRow = typeof workoutSets.$inferSelect;

function setFromRow(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    setIndex: row.setIndex,
    reps: row.reps ?? undefined,
    weightKg: row.weightKg !== null && row.weightKg !== undefined ? Number(row.weightKg) : undefined,
    completed: row.completed,
    rir: row.rir ?? undefined,
    setType: row.setType as WorkoutSet["setType"],
    groupId: row.groupId ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt
  };
}

function eventFromRow(row: typeof events.$inferSelect) {
  return workoutEventSchema.parse({
    id: row.id, type: "workout", occurredAt: row.occurredAt, timezone: row.timezone,
    note: row.note ?? undefined, ...(row.payload as object)
  });
}

async function findWorkoutEventByIdempotencyKey(userId: string, key: string) {
  if (useMemory || !database) {
    return memoryWorkoutEvents.find((event) => event.userId === userId && event.idempotencyKey === key);
  }
  const [row] = await database.select().from(events).where(and(
    eq(events.userId, userId), eq(events.idempotencyKey, key), eq(events.type, "workout")
  )).limit(1);
  return row ? eventFromRow(row) : undefined;
}

async function getWorkoutEvent(userId: string, eventId: string) {
  if (useMemory || !database) {
    return memoryWorkoutEvents.find((event) => event.userId === userId && event.id === eventId);
  }
  const [row] = await database.select().from(events).where(and(
    eq(events.userId, userId), eq(events.id, eventId), eq(events.type, "workout")
  )).limit(1);
  return row ? eventFromRow(row) : undefined;
}

async function getSetsForEvent(userId: string, eventId: string): Promise<WorkoutSet[]> {
  if (useMemory || !database) {
    return memorySets
      .filter((set) => set.userId === userId && set.eventId === eventId)
      .sort((a, b) => a.setIndex - b.setIndex);
  }
  const rows = await database.select().from(workoutSets).where(and(
    eq(workoutSets.userId, userId), eq(workoutSets.eventId, eventId)
  )).orderBy(workoutSets.setIndex);
  return rows.map(setFromRow);
}

async function assertExercisesExist(userId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  let found: number;
  if (useMemory || !database) {
    found = unique.filter((id) => memoryExercises.some((exercise) => exercise.userId === userId && exercise.id === id)).length;
  } else {
    const rows = await database.select({ id: exercises.id }).from(exercises).where(and(
      eq(exercises.userId, userId), inArray(exercises.id, unique)
    ));
    found = rows.length;
  }
  if (found !== unique.length) throw new Error("unknown_exercise");
}

function buildSetRows(userId: string, eventId: string, sets: z.output<typeof recordWorkoutSessionInputSchema>["sets"], occurredAt: Date) {
  return sets.map((set) => ({
    id: randomUUID(),
    userId,
    eventId,
    exerciseId: set.exerciseId,
    setIndex: set.setIndex,
    reps: set.reps ?? null,
    weightKg: set.weightKg !== undefined ? String(set.weightKg) : null,
    completed: set.completed,
    rir: set.rir ?? null,
    setType: set.setType,
    groupId: set.groupId ?? null,
    note: set.note ?? null,
    performedAt: occurredAt,
    createdAt: new Date()
  }));
}

// Creates one "workout" timeline event plus its detail rows (one workoutSets row per set) in a
// single call. Safe to retry: reusing the same idempotencyKey returns the already-created session
// as stored (not as re-submitted), mirroring recordFood.
export async function recordWorkoutSession(userId: string, rawInput: RecordWorkoutSessionInput) {
  const input = recordWorkoutSessionInputSchema.parse(rawInput);

  if (input.idempotencyKey) {
    const existingEvent = await findWorkoutEventByIdempotencyKey(userId, input.idempotencyKey);
    if (existingEvent && existingEvent.type === "workout") {
      const sets = await getSetsForEvent(userId, existingEvent.id);
      return summarizeSession(
        existingEvent.id, existingEvent.occurredAt, existingEvent.timezone, existingEvent.muscleGroups, sets, existingEvent.note
      );
    }
  }

  await assertExercisesExist(userId, input.sets.map((set) => set.exerciseId));

  const eventId = input.eventId ?? randomUUID();
  const workoutEvent = workoutEventSchema.parse({
    id: eventId,
    type: "workout",
    occurredAt: input.occurredAt,
    timezone: input.timezone,
    note: input.note,
    completed: true,
    muscleGroups: input.muscleGroups
  });
  const setRows = buildSetRows(userId, eventId, input.sets, input.occurredAt);
  const sets = setRows.map((row) => setFromRow(row));

  if (useMemory || !database) {
    memoryWorkoutEvents.unshift({ ...workoutEvent, userId, idempotencyKey: input.idempotencyKey });
    for (const set of sets) memorySets.push({ ...set, userId, eventId });
    return summarizeSession(eventId, input.occurredAt, input.timezone, input.muscleGroups, sets, input.note);
  }

  const db = database;
  const { id, type, occurredAt, timezone, note, ...payload } = workoutEvent;
  const statements = [
    db.insert(events).values({
      id, userId, type, occurredAt, timezone, note, payload, idempotencyKey: input.idempotencyKey
    }),
    ...setRows.map((row) => db.insert(workoutSets).values(row))
  ];
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return summarizeSession(eventId, input.occurredAt, input.timezone, input.muscleGroups, sets, input.note);
}

function removeMemorySets(userId: string, eventId: string) {
  for (let i = memorySets.length - 1; i >= 0; i -= 1) {
    if (memorySets[i].userId === userId && memorySets[i].eventId === eventId) memorySets.splice(i, 1);
  }
}

// Replaces a session's metadata and the whole set list atomically (delete + reinsert in one batch).
export async function replaceWorkoutSession(userId: string, eventId: string, rawInput: RecordWorkoutSessionInput) {
  const input = recordWorkoutSessionInputSchema.parse(rawInput);
  const existing = await getWorkoutEvent(userId, eventId);
  if (!existing) return undefined;
  await assertExercisesExist(userId, input.sets.map((set) => set.exerciseId));

  const workoutEvent = workoutEventSchema.parse({
    id: eventId, type: "workout", occurredAt: input.occurredAt, timezone: input.timezone,
    note: input.note, completed: true, muscleGroups: input.muscleGroups
  });
  const setRows = buildSetRows(userId, eventId, input.sets, input.occurredAt);
  const sets = setRows.map((row) => setFromRow(row));

  if (useMemory || !database) {
    const index = memoryWorkoutEvents.findIndex((event) => event.userId === userId && event.id === eventId);
    memoryWorkoutEvents[index] = { ...workoutEvent, userId, idempotencyKey: memoryWorkoutEvents[index].idempotencyKey };
    removeMemorySets(userId, eventId);
    for (const set of sets) memorySets.push({ ...set, userId, eventId });
    return summarizeSession(eventId, input.occurredAt, input.timezone, input.muscleGroups, sets, input.note);
  }

  const db = database;
  const { occurredAt, timezone, note, ...payload } = workoutEvent;
  const statements = [
    db.update(events).set({ occurredAt, timezone, note, payload, updatedAt: new Date() }).where(and(
      eq(events.userId, userId), eq(events.id, eventId)
    )),
    db.delete(workoutSets).where(and(eq(workoutSets.userId, userId), eq(workoutSets.eventId, eventId))),
    ...setRows.map((row) => db.insert(workoutSets).values(row))
  ];
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return summarizeSession(eventId, input.occurredAt, input.timezone, input.muscleGroups, sets, input.note);
}

export async function getWorkoutSession(userId: string, eventId: string) {
  const event = await getWorkoutEvent(userId, eventId);
  if (!event || event.type !== "workout") return undefined;
  const sets = await getSetsForEvent(userId, eventId);
  return summarizeSession(event.id, event.occurredAt, event.timezone, event.muscleGroups, sets, event.note);
}

// Deleting the event cascades to workout_sets in the database (FK on delete cascade); memory mode
// has no FKs, so remove its sets by hand.
export async function deleteWorkoutSession(userId: string, eventId: string) {
  const existing = await getWorkoutEvent(userId, eventId);
  if (!existing) return false;
  if (useMemory || !database) {
    const index = memoryWorkoutEvents.findIndex((event) => event.userId === userId && event.id === eventId);
    memoryWorkoutEvents.splice(index, 1);
    removeMemorySets(userId, eventId);
    return true;
  }
  await database.delete(events).where(and(eq(events.userId, userId), eq(events.id, eventId)));
  return true;
}

function summarizeSession(
  eventId: string, occurredAt: Date, timezone: string, muscleGroups: string[], sets: WorkoutSet[], note?: string
) {
  const working = sets.filter((set) => set.setType !== "warmup");
  const tonnageKg = working.reduce((total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
  const exerciseCount = new Set(sets.map((set) => set.exerciseId)).size;
  return {
    eventId, occurredAt, timezone, muscleGroups, note, sets,
    summary: { setCount: sets.length, exerciseCount, tonnageKg: Math.round(tonnageKg * 10) / 10 }
  };
}

export interface ExerciseHistoryEntry {
  eventId: string;
  date: string;
  topWeightKg?: number;
  totalReps: number;
  bestE1rmKg?: number;
}

export interface ExerciseHistory {
  windowSessions: number;
  bestSet?: { date: string; reps?: number; weightKg?: number };
  bestE1rmKg?: number;
  recentSessions: ExerciseHistoryEntry[];
}

function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

interface HistoryRow {
  eventId: string;
  reps: number | null;
  weightKg: number | null;
  setType: string;
  occurredAt: Date;
  timezone: string;
}

async function loadHistoryRows(userId: string, exerciseId: string): Promise<HistoryRow[]> {
  if (useMemory || !database) {
    return memorySets
      .filter((set) => set.userId === userId && set.exerciseId === exerciseId)
      .flatMap((set) => {
        const event = memoryWorkoutEvents.find((candidate) => candidate.userId === userId && candidate.id === set.eventId);
        return event ? [{
          eventId: set.eventId, reps: set.reps ?? null, weightKg: set.weightKg ?? null,
          setType: set.setType, occurredAt: event.occurredAt, timezone: event.timezone
        }] : [];
      });
  }
  const rows = await database.select({
    eventId: workoutSets.eventId, reps: workoutSets.reps, weightKg: workoutSets.weightKg,
    setType: workoutSets.setType, occurredAt: events.occurredAt, timezone: events.timezone
  }).from(workoutSets).innerJoin(events, eq(events.id, workoutSets.eventId)).where(and(
    eq(workoutSets.userId, userId), eq(workoutSets.exerciseId, exerciseId)
  )).orderBy(desc(events.occurredAt));
  return rows.map((row) => ({ ...row, weightKg: row.weightKg !== null ? Number(row.weightKg) : null }));
}

// Reused by both the Android-facing REST endpoint and the get_exercise_history MCP tool so the query
// logic lives in one place. Warm-up sets never count toward bests; dates use the session's own
// timezone, not UTC.
export async function getExerciseHistory(userId: string, exerciseId: string, limit = 8): Promise<ExerciseHistory> {
  const rows = (await loadHistoryRows(userId, exerciseId)).filter((row) => row.setType !== "warmup");

  const byEvent = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const bucket = byEvent.get(row.eventId) ?? [];
    bucket.push(row);
    byEvent.set(row.eventId, bucket);
  }
  const e1rm = (row: HistoryRow) => (
    row.weightKg !== null && row.reps !== null ? estimateOneRepMaxKg(row.weightKg, row.reps) : undefined
  );
  const maxOf = (values: Array<number | undefined>) => values.reduce<number | undefined>(
    (max, value) => (value !== undefined && (max === undefined || value > max) ? value : max), undefined
  );

  const allSessions = [...byEvent.entries()]
    .map(([eventId, eventSets]) => ({
      eventId,
      date: dateKey(eventSets[0].occurredAt, eventSets[0].timezone),
      topWeightKg: maxOf(eventSets.map((set) => set.weightKg ?? undefined)),
      totalReps: eventSets.reduce((total, set) => total + (set.reps ?? 0), 0),
      bestE1rmKg: maxOf(eventSets.map(e1rm)),
      occurredAt: eventSets[0].occurredAt
    }))
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  let best: { date: string; reps?: number; weightKg?: number } | undefined;
  for (const row of rows) {
    if (row.weightKg === null) continue;
    if (!best || row.weightKg > (best.weightKg ?? 0)) {
      best = { date: dateKey(row.occurredAt, row.timezone), reps: row.reps ?? undefined, weightKg: row.weightKg };
    }
  }

  return {
    windowSessions: Math.min(allSessions.length, limit),
    bestSet: best,
    bestE1rmKg: maxOf(rows.map(e1rm)),
    recentSessions: allSessions.slice(0, limit).map(({ eventId, date, topWeightKg, totalReps, bestE1rmKg }) => ({
      eventId, date, topWeightKg, totalReps, bestE1rmKg
    }))
  };
}

export interface WorkoutForDateExercise {
  exerciseId: string;
  name: string;
  sets: Array<{
    setIndex: number; reps?: number; weightKg?: number; rir?: number;
    setType: WorkoutSet["setType"]; groupId?: string; note?: string; completed: boolean;
  }>;
  history: ExerciseHistory;
}

export interface WorkoutForDateSession {
  eventId: string;
  muscleGroups: string[];
  exercises: WorkoutForDateExercise[];
}

// Returns every workout session for a local calendar day — an array, not a single object, so a
// future multi-session day doesn't need a breaking response-shape change later. The DB query is
// bounded to a UTC window around the date (any timezone's local day falls inside it) and then
// filtered precisely by the requested timezone.
export async function getWorkoutsForDate(userId: string, date: string, timezone: string, historyWindow = 8) {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const windowStart = new Date(dayStart.getTime() - 36 * 3600 * 1000);
  const windowEnd = new Date(dayStart.getTime() + 60 * 3600 * 1000);

  const candidates = useMemory || !database
    ? memoryWorkoutEvents.filter((event) => event.userId === userId)
    : (await database.select().from(events).where(and(
        eq(events.userId, userId), eq(events.type, "workout"),
        gte(events.occurredAt, windowStart), lte(events.occurredAt, windowEnd)
      )).orderBy(desc(events.occurredAt))).map(eventFromRow);

  const dayEvents = candidates.filter((event) => dateKey(event.occurredAt, timezone) === date);
  const sessions: WorkoutForDateSession[] = [];
  const nameCache = new Map<string, string>();
  const historyCache = new Map<string, ExerciseHistory>();
  for (const event of dayEvents) {
    if (event.type !== "workout") continue;
    const sets = await getSetsForEvent(userId, event.id);
    const byExercise = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const bucket = byExercise.get(set.exerciseId) ?? [];
      bucket.push(set);
      byExercise.set(set.exerciseId, bucket);
    }
    const exercisesOut: WorkoutForDateExercise[] = [];
    for (const [exerciseId, exerciseSets] of byExercise) {
      if (!nameCache.has(exerciseId)) {
        nameCache.set(exerciseId, (await getExercise(userId, exerciseId))?.name ?? "Unknown exercise");
      }
      if (!historyCache.has(exerciseId)) {
        historyCache.set(exerciseId, await getExerciseHistory(userId, exerciseId, historyWindow));
      }
      exercisesOut.push({
        exerciseId,
        name: nameCache.get(exerciseId)!,
        sets: exerciseSets
          .sort((a, b) => a.setIndex - b.setIndex)
          .map((set) => ({
            setIndex: set.setIndex, reps: set.reps, weightKg: set.weightKg, rir: set.rir,
            setType: set.setType, groupId: set.groupId, note: set.note, completed: set.completed
          })),
        history: historyCache.get(exerciseId)!
      });
    }
    sessions.push({ eventId: event.id, muscleGroups: event.muscleGroups, exercises: exercisesOut });
  }
  return sessions;
}
