import { z } from "zod";
import { normalizeProductText } from "./nutrition";

// Text normalization is identical to products (NFKC fold, trim, lowercase, collapse whitespace) —
// reuse it directly rather than duplicating.
export const normalizeExerciseText = normalizeProductText;

export const movementPatterns = ["squat", "hinge", "push", "pull", "lunge", "carry", "core", "other"] as const;
export const setTypes = ["working", "warmup", "drop"] as const;

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const externalRefSchema = z.object({
  source: z.string().trim().min(1).max(60),
  id: z.string().trim().min(1).max(200)
});

export const exerciseInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  muscleGroups: z.array(z.string().trim().min(1)).max(8).optional(),
  primaryMuscles: z.array(z.string().trim().min(1)).max(8).optional(),
  secondaryMuscles: z.array(z.string().trim().min(1)).max(12).optional(),
  movementPattern: z.enum(movementPatterns).optional(),
  equipment: z.string().trim().min(1).max(60).optional(),
  images: z.array(z.string().url().refine((value) => value.startsWith("https://"), "images_must_be_https")).max(4).optional(),
  instructions: z.array(z.string().trim().min(1).max(600)).max(20).optional(),
  isArchived: z.boolean().default(false),
  searchAliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  externalRef: externalRefSchema.optional()
});

export const exerciseSchema = exerciseInputSchema.safeExtend({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type ExerciseInput = z.input<typeof exerciseInputSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;

export const setInputSchema = z.object({
  exerciseId: z.string().uuid(),
  setIndex: z.number().int().min(1),
  reps: z.number().int().min(0).optional(),
  weightKg: z.number().min(0).optional(),
  completed: z.boolean().default(true),
  rir: z.number().int().min(0).max(5).optional(),
  setType: z.enum(setTypes).default("working"),
  groupId: z.string().trim().min(1).max(60).optional(),
  note: z.string().max(500).optional()
});

export type SetInput = z.infer<typeof setInputSchema>;

export const recordWorkoutSessionInputSchema = z.object({
  eventId: z.string().uuid().optional(),
  occurredAt: z.coerce.date(),
  timezone: z.string().min(1).refine(isValidTimeZone, "invalid_timezone"),
  muscleGroups: z.array(z.string().trim().min(1)).min(1).max(8),
  // Free-text feedback on the session; stored as the workout event's note.
  note: z.string().max(2000).optional(),
  exertion: z.number().int().min(1).max(5).optional(),
  mood: z.enum(["bad", "ok", "good"]).optional(),
  sets: z.array(setInputSchema).min(1),
  idempotencyKey: z.string().min(1).max(200).optional()
});

export type RecordWorkoutSessionInput = z.input<typeof recordWorkoutSessionInputSchema>;

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  completed: boolean;
  rir?: number;
  setType: (typeof setTypes)[number];
  groupId?: string;
  note?: string;
  createdAt: Date;
}

// Epley estimated one-rep max; only meaningful for 1..12 reps with a positive load.
export function estimateOneRepMaxKg(weightKg: number, reps: number) {
  if (!(weightKg > 0) || reps < 1 || reps > 12) return undefined;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface WorkoutSession {
  eventId: string;
  occurredAt: Date;
  timezone: string;
  muscleGroups: string[];
  note?: string;
  sets: WorkoutSet[];
}
