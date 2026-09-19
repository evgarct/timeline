import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { database } from "@/db/client";
import { events, exercises, workoutSets } from "@/db/schema";
import {
  exerciseInputSchema,
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
    searchAliases: row.searchAliases,
    externalRef: row.externalSource && row.externalId
      ? { source: row.externalSource, id: row.externalId }
      : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export async function searchExercises(userId: string, query = "", page = 1, pageSize = 30) {
  const normalizedQuery = normalizeExerciseText(query);
  if (useMemory || !database) {
    const matches = memoryExercises.filter((exercise) => exercise.userId === userId && (
      !normalizedQuery
      || normalizeExerciseText(exercise.name).includes(normalizedQuery)
      || exercise.searchAliases.some((alias) => normalizeExerciseText(alias).includes(normalizedQuery))
    ));
    const offset = (page - 1) * pageSize;
    return { items: matches.slice(offset, offset + pageSize), page, pageSize, hasMore: offset + pageSize < matches.length };
  }
  const offset = (page - 1) * pageSize;
  const condition = normalizedQuery
    ? and(
        eq(exercises.userId, userId),
        or(
          ilike(exercises.normalizedName, `%${normalizedQuery}%`),
          ilike(exercises.normalizedSearchAliases, `%${normalizedQuery}%`)
        )
      )
    : eq(exercises.userId, userId);
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
      searchAliases: values.searchAliases,
      normalizedSearchAliases: values.normalizedSearchAliases,
      externalSource: values.externalSource,
      externalId: values.externalId,
      updatedAt: values.updatedAt
    }
  });
  return exercise;
}

async function findWorkoutEventByIdempotencyKey(userId: string, key: string) {
  if (useMemory || !database) {
    return memoryWorkoutEvents.find((event) => event.userId === userId && event.idempotencyKey === key);
  }
  const [row] = await database.select().from(events).where(and(
    eq(events.userId, userId), eq(events.idempotencyKey, key), eq(events.type, "workout")
  )).limit(1);
  if (!row) return undefined;
  return workoutEventSchema.parse({
    id: row.id, type: "workout", occurredAt: row.occurredAt, timezone: row.timezone,
    note: row.note ?? undefined, ...(row.payload as object)
  });
}

async function getSetsForEvent(userId: string, eventId: string): Promise<WorkoutSet[]> {
  if (useMemory || !database) {
    return memorySets.filter((set) => set.userId === userId && set.eventId === eventId);
  }
  const rows = await database.select().from(workoutSets).where(and(
    eq(workoutSets.userId, userId), eq(workoutSets.eventId, eventId)
  )).orderBy(workoutSets.setIndex);
  return rows.map((row) => ({
    id: row.id,
    exerciseId: row.exerciseId,
    setIndex: row.setIndex,
    reps: row.reps ?? undefined,
    weightKg: row.weightKg !== null && row.weightKg !== undefined ? Number(row.weightKg) : undefined,
    completed: row.completed,
    createdAt: row.createdAt
  }));
}

// Creates one "workout" timeline event plus its detail rows (one workoutSets row per set) in a
// single call. Safe to retry: reusing the same idempotencyKey returns the already-created session
// instead of double-writing, mirroring recordFood.
export async function recordWorkoutSession(userId: string, rawInput: RecordWorkoutSessionInput) {
  const input = recordWorkoutSessionInputSchema.parse(rawInput);

  if (input.idempotencyKey) {
    const existingEvent = await findWorkoutEventByIdempotencyKey(userId, input.idempotencyKey);
    if (existingEvent) {
      const sets = await getSetsForEvent(userId, existingEvent.id);
      return summarizeSession(existingEvent.id, input.occurredAt, input.timezone, input.muscleGroups, sets);
    }
  }

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

  const setRows = input.sets.map((set) => ({
    id: randomUUID(),
    userId,
    eventId,
    exerciseId: set.exerciseId,
    setIndex: set.setIndex,
    reps: set.reps ?? null,
    weightKg: set.weightKg !== undefined ? String(set.weightKg) : null,
    completed: set.completed,
    createdAt: new Date()
  }));

  if (useMemory || !database) {
    memoryWorkoutEvents.unshift({ ...workoutEvent, userId, idempotencyKey: input.idempotencyKey });
    for (const row of setRows) {
      memorySets.push({
        id: row.id,
        exerciseId: row.exerciseId,
        setIndex: row.setIndex,
        reps: row.reps ?? undefined,
        weightKg: row.weightKg !== null ? Number(row.weightKg) : undefined,
        completed: row.completed,
        createdAt: row.createdAt,
        userId,
        eventId
      });
    }
    return summarizeSession(eventId, input.occurredAt, input.timezone, input.muscleGroups, setRows.map((row) => ({
      id: row.id, exerciseId: row.exerciseId, setIndex: row.setIndex,
      reps: row.reps ?? undefined, weightKg: row.weightKg !== null ? Number(row.weightKg) : undefined,
      completed: row.completed, createdAt: row.createdAt
    })));
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

  const sets = setRows.map((row) => ({
    id: row.id, exerciseId: row.exerciseId, setIndex: row.setIndex,
    reps: row.reps ?? undefined, weightKg: row.weightKg !== null ? Number(row.weightKg) : undefined,
    completed: row.completed, createdAt: row.createdAt
  }));
  return summarizeSession(eventId, input.occurredAt, input.timezone, input.muscleGroups, sets);
}

function summarizeSession(
  eventId: string, occurredAt: Date, timezone: string, muscleGroups: string[], sets: WorkoutSet[]
) {
  const tonnageKg = sets.reduce((total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
  const exerciseCount = new Set(sets.map((set) => set.exerciseId)).size;
  return {
    eventId, occurredAt, timezone, muscleGroups, sets,
    summary: { setCount: sets.length, exerciseCount, tonnageKg: Math.round(tonnageKg * 10) / 10 }
  };
}

export interface ExerciseHistoryEntry {
  eventId: string;
  date: string;
  topWeightKg?: number;
  totalReps: number;
}

export interface ExerciseHistory {
  windowSessions: number;
  bestSet?: { date: string; reps?: number; weightKg?: number };
  recentSessions: ExerciseHistoryEntry[];
}

// Reused by both the Android-facing REST endpoint and the get_exercise_history MCP tool so the query
// logic lives in one place.
export async function getExerciseHistory(userId: string, exerciseId: string, limit = 8): Promise<ExerciseHistory> {
  let rows: Array<{ eventId: string; setIndex: number; reps: number | null; weightKg: number | null; createdAt: Date }>;
  if (useMemory || !database) {
    rows = memorySets
      .filter((set) => set.userId === userId && set.exerciseId === exerciseId)
      .map((set) => ({
        eventId: set.eventId,
        setIndex: set.setIndex, reps: set.reps ?? null, weightKg: set.weightKg ?? null, createdAt: set.createdAt
      }));
  } else {
    rows = (await database.select().from(workoutSets).where(and(
      eq(workoutSets.userId, userId), eq(workoutSets.exerciseId, exerciseId)
    )).orderBy(desc(workoutSets.createdAt))).map((row) => ({
      eventId: row.eventId, setIndex: row.setIndex, reps: row.reps,
      weightKg: row.weightKg !== null ? Number(row.weightKg) : null, createdAt: row.createdAt
    }));
  }

  const byEvent = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = byEvent.get(row.eventId) ?? [];
    bucket.push(row);
    byEvent.set(row.eventId, bucket);
  }
  const sessions = [...byEvent.entries()]
    .map(([eventId, eventSets]) => ({
      eventId,
      date: eventSets[0].createdAt.toISOString().slice(0, 10),
      topWeightKg: eventSets.reduce<number | undefined>((max, set) => (
        set.weightKg !== null && (max === undefined || set.weightKg > max) ? set.weightKg : max
      ), undefined),
      totalReps: eventSets.reduce((total, set) => total + (set.reps ?? 0), 0),
      createdAt: eventSets[0].createdAt
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  let best: { date: string; reps?: number; weightKg?: number } | undefined;
  for (const row of rows) {
    if (row.weightKg === null) continue;
    if (!best || row.weightKg > (best.weightKg ?? 0)) {
      best = { date: row.createdAt.toISOString().slice(0, 10), reps: row.reps ?? undefined, weightKg: row.weightKg };
    }
  }

  return {
    windowSessions: sessions.length,
    bestSet: best,
    recentSessions: sessions.map(({ eventId, date, topWeightKg, totalReps }) => ({ eventId, date, topWeightKg, totalReps }))
  };
}

function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

export interface WorkoutForDateExercise {
  exerciseId: string;
  name: string;
  sets: Array<{ setIndex: number; reps?: number; weightKg?: number }>;
  history: ExerciseHistory;
}

export interface WorkoutForDateSession {
  eventId: string;
  muscleGroups: string[];
  exercises: WorkoutForDateExercise[];
}

// Returns every workout session for a local calendar day — an array, not a single object, so a
// future multi-session day doesn't need a breaking response-shape change later.
export async function getWorkoutsForDate(userId: string, date: string, timezone: string, historyWindow = 8) {
  const allEvents: TimelineEvent[] = useMemory || !database
    ? memoryWorkoutEvents.filter((event) => event.userId === userId)
    : (await database.select().from(events).where(and(
        eq(events.userId, userId), eq(events.type, "workout")
      )).orderBy(desc(events.occurredAt))).map((row) => workoutEventSchema.parse({
        id: row.id, type: "workout", occurredAt: row.occurredAt, timezone: row.timezone,
        note: row.note ?? undefined, ...(row.payload as object)
      }));

  const dayEvents = allEvents.filter((event) => dateKey(event.occurredAt, timezone) === date);
  const sessions: WorkoutForDateSession[] = [];
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
      const exercise = await getExercise(userId, exerciseId);
      const history = await getExerciseHistory(userId, exerciseId, historyWindow);
      exercisesOut.push({
        exerciseId,
        name: exercise?.name ?? "Unknown exercise",
        sets: exerciseSets
          .sort((a, b) => a.setIndex - b.setIndex)
          .map((set) => ({ setIndex: set.setIndex, reps: set.reps, weightKg: set.weightKg })),
        history
      });
    }
    sessions.push({ eventId: event.id, muscleGroups: event.muscleGroups, exercises: exercisesOut });
  }
  return sessions;
}
