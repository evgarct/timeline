import { z } from "zod";

export const eventTypeSchema = z.enum(["progress_photo", "workout", "measurements", "inbody"]);
export type EventType = z.infer<typeof eventTypeSchema>;

const baseEventSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.coerce.date(),
  timezone: z.string().min(1),
  note: z.string().max(2000).optional()
});

export const progressPhotoEventSchema = baseEventSchema.extend({
  type: z.literal("progress_photo"),
  photos: z.array(z.object({
    id: z.string(),
    url: z.string(),
    originalUrl: z.string().optional(),
    alt: z.string()
  })).min(1).max(12)
});

export const workoutEventSchema = baseEventSchema.extend({
  type: z.literal("workout"),
  completed: z.boolean(),
  muscleGroups: z.array(z.string().min(1)).min(1).max(8)
});

export const measurementsEventSchema = baseEventSchema.extend({
  type: z.literal("measurements"),
  values: z.object({
    weightKg: z.number().positive().optional(),
    waistCm: z.number().positive().optional(),
    chestCm: z.number().positive().optional(),
    neckCm: z.number().positive().optional(),
    leftBicepCm: z.number().positive().optional(),
    rightBicepCm: z.number().positive().optional(),
    leftThighCm: z.number().positive().optional(),
    rightThighCm: z.number().positive().optional(),
    leftCalfCm: z.number().positive().optional(),
    rightCalfCm: z.number().positive().optional()
  }).refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one measurement is required"
  })
});

export const inbodyMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  referenceMin: z.number().optional(),
  referenceMax: z.number().optional(),
  segment: z.enum(["left_arm", "right_arm", "trunk", "left_leg", "right_leg"]).optional(),
  category: z.enum(["composition", "obesity", "control", "research", "segmental_lean", "segmental_fat", "impedance", "other"])
});

export const inbodyEventSchema = baseEventSchema.extend({
  type: z.literal("inbody"),
  source: z.object({
    url: z.string(),
    mimeType: z.enum(["application/pdf", "image/heic", "image/heif", "image/jpeg", "image/png"]),
    fileName: z.string().min(1)
  }),
  metrics: z.array(inbodyMetricSchema).min(1),
  extraction: z.object({
    method: z.enum(["mcp_agent", "local_ocr", "manual"]),
    reviewed: z.boolean()
  })
});

export const timelineEventSchema = z.discriminatedUnion("type", [
  progressPhotoEventSchema,
  workoutEventSchema,
  measurementsEventSchema,
  inbodyEventSchema
]);

export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type InBodyMetric = z.infer<typeof inbodyMetricSchema>;

export const taskScheduleSchema = z.object({
  id: z.string(),
  eventType: eventTypeSchema,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  intervalWeeks: z.number().int().min(1).max(52),
  enabled: z.boolean(),
  anchorDate: z.coerce.date()
});

export type TaskSchedule = z.infer<typeof taskScheduleSchema>;

