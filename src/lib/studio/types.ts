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
  /** Canonical YouTube watch URL of an optional how-to video. */
  videoUrl?: string;
  isArchived?: boolean;
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

export interface FeedbackEntry {
  id: string;
  category: "bug" | "friction" | "missing_tool" | "works_well" | "suggestion" | "other";
  severity?: "low" | "medium" | "high";
  tool?: string;
  summary: string;
  details?: string;
  expected?: string;
  suggestion?: string;
  toolCalls?: Array<{ tool: string; outcome: "ok" | "error" | "confusing"; note?: string }>;
  source: "mcp" | "webmcp" | "rest";
  client?: string;
  page?: string;
  status: "new" | "triaged" | "done" | "wontfix";
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseHistory {
  windowSessions: number;
  bestE1rmKg?: number | null;
  recentSessions: Array<{ eventId: string; date: string; topWeightKg?: number | null; totalReps?: number | null; bestE1rmKg?: number | null }>;
}
