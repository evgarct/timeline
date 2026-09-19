import { z } from "zod";
import { normalizeProductText } from "./nutrition";

// Text normalization is identical to products (NFKC fold, trim, lowercase, collapse whitespace) —
// reuse it directly rather than duplicating.
export const normalizeExerciseText = normalizeProductText;

export const externalRefSchema = z.object({
  source: z.string().trim().min(1).max(60),
  id: z.string().trim().min(1).max(200)
});

export const exerciseInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  muscleGroups: z.array(z.string().trim().min(1)).max(8).optional(),
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
  completed: z.boolean().default(true)
});

export type SetInput = z.infer<typeof setInputSchema>;

export const recordWorkoutSessionInputSchema = z.object({
  eventId: z.string().uuid().optional(),
  occurredAt: z.coerce.date(),
  timezone: z.string().min(1),
  muscleGroups: z.array(z.string().trim().min(1)).min(1).max(8),
  note: z.string().max(2000).optional(),
  sets: z.array(setInputSchema).min(1),
  idempotencyKey: z.string().min(1).max(200).optional()
});

export type RecordWorkoutSessionInput = z.infer<typeof recordWorkoutSessionInputSchema>;

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  completed: boolean;
  createdAt: Date;
}

export interface WorkoutSession {
  eventId: string;
  occurredAt: Date;
  timezone: string;
  muscleGroups: string[];
  note?: string;
  sets: WorkoutSet[];
}
