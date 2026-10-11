import { z } from "zod";
import { normalizeProductText } from "./nutrition";

export const normalizeTemplateName = normalizeProductText;

// Double progression: hold the load until every working set reaches the top of the rep range,
// then add `incrementKg`. Deliberately the only rule for now; the discriminator leaves room for more.
export const progressionRuleSchema = z.object({
  type: z.literal("double"),
  incrementKg: z.number().positive().max(50)
});

export const templateExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(20).default(3),
  // Planned working weight (kg). Used as the starting load; a progression rule with history takes over later.
  weightKg: z.number().min(0).max(1000).optional(),
  repMin: z.number().int().min(1).max(100).optional(),
  repMax: z.number().int().min(1).max(100).optional(),
  targetRir: z.number().int().min(0).max(5).optional(),
  groupId: z.string().trim().min(1).max(60).optional(),
  // Human label shown on the superset tab (e.g. "Суперсет на пресс"); falls back to a generic "Superset".
  groupLabel: z.string().trim().min(1).max(80).optional(),
  progression: progressionRuleSchema.optional(),
  note: z.string().max(500).optional()
}).refine((value) => value.repMin === undefined || value.repMax === undefined || value.repMin <= value.repMax, {
  message: "repMin_must_not_exceed_repMax", path: ["repMin"]
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "invalid_date");

/**
 * When a template is meant to be trained: weekdays use JavaScript's numbering (0 = Sunday ... 6 = Saturday, the same as
 * task schedules), optionally limited to a date range (YYYY-MM-DD, inclusive), e.g. an 8-week block.
 */
export const templateScheduleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  startDate: isoDate.optional(),
  endDate: isoDate.optional()
}).refine((schedule) => !schedule.startDate || !schedule.endDate || schedule.startDate <= schedule.endDate, {
  message: "startDate_must_not_exceed_endDate", path: ["startDate"]
});

export type TemplateSchedule = z.infer<typeof templateScheduleSchema>;

/** True when `date` (YYYY-MM-DD, with its JS weekday) falls on the template's schedule. */
export function isScheduledOn(schedule: TemplateSchedule | null | undefined, date: string, weekday: number) {
  if (!schedule || !schedule.weekdays.includes(weekday)) return false;
  return (!schedule.startDate || date >= schedule.startDate) && (!schedule.endDate || date <= schedule.endDate);
}

export const workoutTemplateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  note: z.string().max(2000).optional(),
  exercises: z.array(templateExerciseSchema).min(1).max(30),
  // null clears the schedule; omitting it keeps whatever is stored.
  schedule: templateScheduleSchema.nullish(),
  isArchived: z.boolean().default(false)
});

export const workoutTemplateSchema = workoutTemplateInputSchema.safeExtend({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

/** Partial change of one template exercise, addressed by 0-based `index` or `exerciseId`; null clears an optional field. */
export const templateExercisePatchSchema = z.object({
  index: z.number().int().min(0).max(29).optional(),
  exerciseId: z.string().uuid().optional(),
  sets: z.number().int().min(1).max(20).optional(),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  repMin: z.number().int().min(1).max(100).nullable().optional(),
  repMax: z.number().int().min(1).max(100).nullable().optional(),
  targetRir: z.number().int().min(0).max(5).nullable().optional(),
  groupId: z.string().trim().min(1).max(60).nullable().optional(),
  groupLabel: z.string().trim().min(1).max(80).nullable().optional(),
  progression: progressionRuleSchema.nullable().optional(),
  note: z.string().max(500).nullable().optional()
}).refine((patch) => patch.index !== undefined || patch.exerciseId !== undefined, { message: "index_or_exerciseId_required" });

export const templatePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  note: z.string().max(2000).nullable().optional(),
  isArchived: z.boolean().optional(),
  schedule: templateScheduleSchema.nullable().optional(),
  exercises: z.array(templateExercisePatchSchema).max(30).optional()
});

export type TemplatePatchInput = z.infer<typeof templatePatchSchema>;
export type TemplateExercise = z.infer<typeof templateExerciseSchema>;
export type WorkoutTemplateInput = z.input<typeof workoutTemplateInputSchema>;
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;

export interface LastSet {
  reps?: number;
  weightKg?: number;
  rir?: number;
}

export interface LoadSuggestion {
  weightKg?: number;
  reason: "no_history" | "increase" | "hold" | "planned";
}

/**
 * Suggests the working weight for the next session from the last session's working sets.
 * Never invents a load without history, and never suggests a drop: failing to hit the top of the
 * range simply holds the weight (the lifter decides about deloads).
 */
export function suggestNextLoad(
  exercise: Pick<TemplateExercise, "repMax" | "progression">,
  lastSets: LastSet[]
): LoadSuggestion {
  const working = lastSets.filter((set) => set.weightKg !== undefined && set.reps !== undefined);
  if (!working.length) return { reason: "no_history" };
  const top = Math.max(...working.map((set) => set.weightKg as number));
  const topSets = working.filter((set) => set.weightKg === top);

  const rule = exercise.progression;
  if (rule?.type === "double" && exercise.repMax !== undefined) {
    const reachedTop = topSets.every((set) => (set.reps as number) >= (exercise.repMax as number));
    if (reachedTop) return { weightKg: Math.round((top + rule.incrementKg) * 100) / 100, reason: "increase" };
  }
  return { weightKg: top, reason: "hold" };
}
