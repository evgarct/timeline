/** The slice of an exercise that decides which muscles a set trains. */
export interface MuscleSource {
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  muscleGroups?: string[];
}

/** Primary muscles, falling back to the legacy `muscleGroups` list when an exercise has none. */
export function primaryMusclesOf(exercise: MuscleSource): string[] {
  return exercise.primaryMuscles?.length ? exercise.primaryMuscles : exercise.muscleGroups ?? [];
}

/**
 * Muscles that are counted together in volume: a hip abductor machine trains the gluteus medius, so "abductors" are glutes
 * for weekly volume. Applied when reading, so existing exercise rows need no change.
 */
export const rollupMuscle = (muscle: string) => (muscle === "abductors" ? "glutes" : muscle);

/**
 * Hard sets per muscle for a list of planned exercises, counted like `getMuscleVolume`:
 * a primary muscle gets 1 per set, a secondary muscle 0.5 (unless it is also primary).
 * Shared by the Studio builder, the REST preview and the MCP `preview_template_volume` tool.
 */
export function muscleSetTotals(items: Array<{ sets: number; exercise: MuscleSource }>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const primary = [...new Set(primaryMusclesOf(item.exercise).map(rollupMuscle))];
    for (const muscle of primary) totals[muscle] = (totals[muscle] ?? 0) + item.sets;
    for (const muscle of new Set((item.exercise.secondaryMuscles ?? []).map(rollupMuscle))) {
      if (!primary.includes(muscle)) totals[muscle] = (totals[muscle] ?? 0) + item.sets * 0.5;
    }
  }
  return totals;
}
