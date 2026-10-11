import type { TemplateExercise } from "@/domain/workout-templates";

/** JSON shape of an exercise as returned by /api/exercises (only the fields Studio reads). */
export interface ExerciseSummary {
  id: string;
  name: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  muscleGroups?: string[];
  movementPattern?: string;
  equipment?: string;
  images?: string[];
  instructions?: string[];
}

export interface ExercisePage {
  items: ExerciseSummary[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ExerciseFacet { value: string; count: number }
export interface ExerciseFacets {
  total: number;
  muscles: ExerciseFacet[];
  equipment: ExerciseFacet[];
  movementPatterns: ExerciseFacet[];
}

/** JSON shape of a stored template (dates are ISO strings over the wire). */
export interface StoredTemplate {
  id: string;
  name: string;
  note?: string;
  exercises: TemplateExercise[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MuscleVolumeWeek {
  weekStart: string;
  sets: Record<string, number>;
  totalSets: number;
}

export interface RecentWorkoutSession {
  eventId: string;
  occurredAt: string;
  timezone: string;
  muscleGroups: string[];
  note?: string | null;
  exertion?: number | null;
  mood?: string | null;
  exercises: Array<{ exerciseId: string; name: string; sets: Array<{ reps?: number | null; weightKg?: number | null; completed?: boolean; setType?: string; rir?: number | null }> }>;
  summary: { setCount: number; exerciseCount: number; tonnageKg: number };
}

export interface ExerciseHistory {
  windowSessions: number;
  bestE1rmKg?: number | null;
  recentSessions: Array<{ eventId: string; date: string; topWeightKg?: number | null; totalReps?: number | null; bestE1rmKg?: number | null }>;
}
