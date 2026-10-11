import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { database } from "@/db/client";
import { workoutTemplates } from "@/db/schema";
import { getExercise, getExercisesByIds, getLastSession } from "@/data/exercise-repository";
import {
  normalizeTemplateName,
  suggestNextLoad,
  templateExerciseSchema,
  workoutTemplateInputSchema,
  workoutTemplateSchema,
  type LoadSuggestion,
  type TemplateExercise,
  type TemplateSchedule,
  type WorkoutTemplate,
  type WorkoutTemplateInput
} from "@/domain/workout-templates";

interface MemoryTemplate extends WorkoutTemplate {
  userId: string;
}

const memoryTemplates: MemoryTemplate[] = [];
const useMemory = process.env.E2E_DEMO_MODE === "true" || !database;

function templateFromRow(row: typeof workoutTemplates.$inferSelect): WorkoutTemplate {
  return workoutTemplateSchema.parse({
    id: row.id,
    name: row.name,
    note: row.note ?? undefined,
    exercises: (row.exercises as unknown[]).map((entry) => templateExerciseSchema.parse(entry)),
    schedule: row.schedule ?? undefined,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export async function listTemplates(userId: string, includeArchived = false): Promise<WorkoutTemplate[]> {
  if (useMemory || !database) {
    return memoryTemplates
      .filter((template) => template.userId === userId && (includeArchived || !template.isArchived))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  const scope = includeArchived
    ? eq(workoutTemplates.userId, userId)
    : and(eq(workoutTemplates.userId, userId), eq(workoutTemplates.isArchived, false));
  const rows = await database.select().from(workoutTemplates).where(scope).orderBy(desc(workoutTemplates.updatedAt));
  return rows.map(templateFromRow);
}

export async function getTemplate(userId: string, id: string): Promise<WorkoutTemplate | undefined> {
  if (useMemory || !database) {
    return memoryTemplates.find((template) => template.userId === userId && template.id === id);
  }
  const [row] = await database.select().from(workoutTemplates).where(and(
    eq(workoutTemplates.userId, userId), eq(workoutTemplates.id, id)
  )).limit(1);
  return row ? templateFromRow(row) : undefined;
}

async function findTemplateByName(userId: string, normalizedName: string) {
  if (useMemory || !database) {
    return memoryTemplates.find((template) => template.userId === userId && normalizeTemplateName(template.name) === normalizedName);
  }
  const [row] = await database.select().from(workoutTemplates).where(and(
    eq(workoutTemplates.userId, userId), eq(workoutTemplates.normalizedName, normalizedName)
  )).limit(1);
  return row ? templateFromRow(row) : undefined;
}

// Dedup mirrors upsertExercise: explicit id, then exact normalized name. Every referenced exercise
// must already exist (unknown_exercise), so a template can never point at nothing.
export async function upsertTemplate(userId: string, rawInput: WorkoutTemplateInput): Promise<WorkoutTemplate> {
  const input = workoutTemplateInputSchema.parse(rawInput);
  for (const id of new Set(input.exercises.map((entry) => entry.exerciseId))) {
    if (!(await getExercise(userId, id))) throw new Error("unknown_exercise");
  }

  const normalizedName = normalizeTemplateName(input.name);
  let existing = input.id ? await getTemplate(userId, input.id) : undefined;
  if (!existing) existing = await findTemplateByName(userId, normalizedName);
  const now = new Date();
  const template = workoutTemplateSchema.parse({
    ...input,
    // Callers that do not know about schedules (the phone's "save as template") must not wipe it; null clears it.
    schedule: input.schedule === undefined ? existing?.schedule : input.schedule,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });

  if (useMemory || !database) {
    const index = memoryTemplates.findIndex((item) => item.userId === userId && item.id === template.id);
    const stored = { ...template, userId };
    if (index >= 0) memoryTemplates[index] = stored;
    else memoryTemplates.unshift(stored);
    return template;
  }

  const values = {
    id: template.id, userId, name: template.name, normalizedName, note: template.note ?? null,
    exercises: template.exercises, schedule: template.schedule ?? null, isArchived: template.isArchived,
    createdAt: template.createdAt, updatedAt: template.updatedAt
  };
  await database.insert(workoutTemplates).values(values).onConflictDoUpdate({
    target: workoutTemplates.id,
    set: {
      name: values.name, normalizedName: values.normalizedName, note: values.note,
      exercises: values.exercises, schedule: values.schedule, isArchived: values.isArchived, updatedAt: values.updatedAt
    }
  });
  return template;
}

/** A copy under a free name ("X (copy)", "X (copy 2)"...): upsertTemplate would otherwise treat an equal name as an update. */
export async function duplicateTemplate(userId: string, id: string, name?: string): Promise<WorkoutTemplate | undefined> {
  const source = await getTemplate(userId, id);
  if (!source) return undefined;
  const base = name?.trim() || source.name;
  let candidate = name?.trim() || `${source.name} (copy)`;
  for (let attempt = 2; await findTemplateByName(userId, normalizeTemplateName(candidate)); attempt += 1) {
    candidate = `${base} (copy ${attempt})`;
  }
  return upsertTemplate(userId, { name: candidate, note: source.note, exercises: source.exercises, isArchived: false });
}

export async function deleteTemplate(userId: string, id: string): Promise<boolean> {
  if (!(await getTemplate(userId, id))) return false;
  if (useMemory || !database) {
    memoryTemplates.splice(memoryTemplates.findIndex((item) => item.userId === userId && item.id === id), 1);
    return true;
  }
  await database.delete(workoutTemplates).where(and(eq(workoutTemplates.userId, userId), eq(workoutTemplates.id, id)));
  return true;
}

// With a progression rule and history, the rule decides. Otherwise an explicit planned weight wins
// (the lifter wrote it into the template on purpose); history only fills in when nothing is planned.
function chooseLoad(entry: TemplateExercise, lastSets: Array<{ reps?: number; weightKg?: number }>): LoadSuggestion {
  const fromHistory = suggestNextLoad(entry, lastSets);
  if (entry.progression && fromHistory.reason !== "no_history") return fromHistory;
  if (entry.weightKg !== undefined) return { weightKg: entry.weightKg, reason: "planned" };
  return fromHistory;
}

export interface PlannedExercise extends TemplateExercise {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment?: string;
  images: string[];
  instructions: string[];
  videoUrl?: string;
  lastDate?: string;
  lastSets: Array<{ reps?: number; weightKg?: number }>;
  suggestion: LoadSuggestion;
}

// What to do in the next session: the prescription plus, per exercise, last time's sets and a load
// suggestion from the progression rule. Read-only; nothing is recorded until the session is logged.
export async function planTemplate(userId: string, id: string) {
  const template = await getTemplate(userId, id);
  if (!template) return undefined;
  const exercises: PlannedExercise[] = [];
  for (const entry of template.exercises) {
    const exercise = await getExercise(userId, entry.exerciseId);
    const last = await getLastSession(userId, entry.exerciseId);
    const lastSets = last?.sets ?? [];
    exercises.push({
      ...entry,
      name: exercise?.name ?? "Unknown exercise",
      primaryMuscles: exercise?.primaryMuscles ?? exercise?.muscleGroups ?? [],
      secondaryMuscles: exercise?.secondaryMuscles ?? [],
      equipment: exercise?.equipment,
      images: exercise?.images ?? [],
      instructions: exercise?.instructions ?? [],
      videoUrl: exercise?.videoUrl,
      lastDate: last?.date,
      lastSets,
      suggestion: chooseLoad(entry, lastSets)
    });
  }
  return { id: template.id, name: template.name, note: template.note, schedule: template.schedule ?? undefined, exercises };
}

export interface TemplateExerciseView extends TemplateExercise {
  name: string;
  primaryMuscles: string[];
  equipment?: string;
  videoUrl?: string;
}

export type WorkoutTemplateView = Omit<WorkoutTemplate, "exercises"> & { exercises: TemplateExerciseView[] };

/**
 * Templates store only exercise ids. For reading (agents, clients) each entry also carries the exercise's name, primary
 * muscles, equipment and video, from one batched lookup; writes still take the plain template.
 */
export async function withExerciseDetails(userId: string, templates: WorkoutTemplate[]): Promise<WorkoutTemplateView[]> {
  const byId = await getExercisesByIds(userId, templates.flatMap((template) => template.exercises.map((entry) => entry.exerciseId)));
  return templates.map((template) => ({
    ...template,
    exercises: template.exercises.map((entry) => {
      const exercise = byId.get(entry.exerciseId);
      return {
        ...entry,
        name: exercise?.name ?? "Unknown exercise",
        primaryMuscles: exercise?.primaryMuscles ?? exercise?.muscleGroups ?? [],
        equipment: exercise?.equipment,
        videoUrl: exercise?.videoUrl
      };
    })
  }));
}

/** Fields of one template exercise a patch may change; null clears an optional field. */
export interface TemplateExercisePatch {
  /** 0-based position, or the exercise id (first match). One of them is required. */
  index?: number;
  exerciseId?: string;
  sets?: number;
  weightKg?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  targetRir?: number | null;
  groupId?: string | null;
  groupLabel?: string | null;
  progression?: TemplateExercise["progression"] | null;
  note?: string | null;
}

export interface TemplatePatch {
  name?: string;
  note?: string | null;
  isArchived?: boolean;
  schedule?: TemplateSchedule | null;
  exercises?: TemplateExercisePatch[];
}

const clearable = ["weightKg", "repMin", "repMax", "targetRir", "groupId", "groupLabel", "progression", "note"] as const;

/**
 * Partial update: change the name/note/schedule/archive flag and individual exercises without resending the whole
 * list (the full upsert replaces every exercise). Unknown positions or exercises are an error, never a silent no-op.
 */
export async function patchTemplate(userId: string, id: string, patch: TemplatePatch): Promise<WorkoutTemplate | undefined> {
  const template = await getTemplate(userId, id);
  if (!template) return undefined;
  const exercises = template.exercises.map((entry) => ({ ...entry }));
  for (const change of patch.exercises ?? []) {
    const position = change.index !== undefined
      ? change.index
      : exercises.findIndex((entry) => entry.exerciseId === change.exerciseId);
    const target = exercises[position];
    if (change.index === undefined && change.exerciseId === undefined) throw new Error("exercise_selector_required");
    if (!target || position < 0) throw new Error("exercise_not_in_template");
    if (change.sets !== undefined) target.sets = change.sets;
    for (const key of clearable) {
      const value = change[key];
      if (value === undefined) continue;
      (target as Record<string, unknown>)[key] = value === null ? undefined : value;
    }
  }
  return upsertTemplate(userId, {
    id: template.id,
    name: patch.name ?? template.name,
    note: patch.note === undefined ? template.note : patch.note ?? undefined,
    exercises,
    schedule: patch.schedule === undefined ? template.schedule : patch.schedule,
    isArchived: patch.isArchived ?? template.isArchived
  });
}
