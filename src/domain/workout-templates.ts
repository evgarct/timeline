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

export const workoutTemplateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  note: z.string().max(2000).optional(),
  exercises: z.array(templateExerciseSchema).min(1).max(30),
  isArchived: z.boolean().default(false)
});

export const workoutTemplateSchema = workoutTemplateInputSchema.safeExtend({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

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
