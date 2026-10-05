import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { database } from "@/db/client";
import { workoutTemplates } from "@/db/schema";
import { getExercise, getLastSessionSets } from "@/data/exercise-repository";
import {
  normalizeTemplateName,
  suggestNextLoad,
  templateExerciseSchema,
  workoutTemplateInputSchema,
  workoutTemplateSchema,
  type LoadSuggestion,
  type TemplateExercise,
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
    exercises: template.exercises, isArchived: template.isArchived,
    createdAt: template.createdAt, updatedAt: template.updatedAt
  };
  await database.insert(workoutTemplates).values(values).onConflictDoUpdate({
    target: workoutTemplates.id,
    set: {
      name: values.name, normalizedName: values.normalizedName, note: values.note,
      exercises: values.exercises, isArchived: values.isArchived, updatedAt: values.updatedAt
    }
  });
  return template;
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

export interface PlannedExercise extends TemplateExercise {
  name: string;
  primaryMuscles: string[];
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
    const lastSets = await getLastSessionSets(userId, entry.exerciseId);
    exercises.push({
      ...entry,
      name: exercise?.name ?? "Unknown exercise",
      primaryMuscles: exercise?.primaryMuscles ?? exercise?.muscleGroups ?? [],
      lastSets,
      suggestion: suggestNextLoad(entry, lastSets)
    });
  }
  return { id: template.id, name: template.name, note: template.note, exercises };
}
