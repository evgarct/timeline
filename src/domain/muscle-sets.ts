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
 * Hard sets per muscle for a list of planned exercises, counted like `getMuscleVolume`:
 * a primary muscle gets 1 per set, a secondary muscle 0.5 (unless it is also primary).
 * Shared by the Studio builder, the REST preview and the MCP `preview_template_volume` tool.
 */
export function muscleSetTotals(items: Array<{ sets: number; exercise: MuscleSource }>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const primary = primaryMusclesOf(item.exercise);
    for (const muscle of primary) totals[muscle] = (totals[muscle] ?? 0) + item.sets;
    for (const muscle of item.exercise.secondaryMuscles ?? []) {
      if (!primary.includes(muscle)) totals[muscle] = (totals[muscle] ?? 0) + item.sets * 0.5;
    }
  }
  return totals;
}
