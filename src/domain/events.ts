import { z } from "zod";
import { INBODY_CATEGORIES, INBODY_SEGMENTS, inBodyDefinition, inBodyMetricIdentity } from "./inbody-catalog";
import { nutritionEntryPayloadSchema } from "./nutrition";

export const eventTypeSchema = z.enum(["progress_photo", "workout", "measurements", "inbody", "nutrition_entry"]);
export type EventType = z.infer<typeof eventTypeSchema>;

const baseEventSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.coerce.date(),
  timezone: z.string().min(1),
  note: z.string().max(2000).optional()
});

const photoPaletteSchema = z.object({
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i)
});

export const progressPhotoEventSchema = baseEventSchema.extend({
  type: z.literal("progress_photo"),
  photos: z.array(z.object({
    id: z.string(),
    assetId: z.string().uuid().optional(),
    url: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    palette: photoPaletteSchema.optional(),
    alt: z.string()
  }).refine((photo) => photo.assetId || photo.url, {
    message: "Photo requires a managed asset or display URL"
  })).min(1).max(12)
});

export const workoutEventSchema = baseEventSchema.extend({
  type: z.literal("workout"),
  completed: z.boolean(),
  muscleGroups: z.array(z.string().min(1)).min(1).max(8),
  // How the session felt, entered at the end: effort 1 (very easy) to 5 (very hard), and mood.
  exertion: z.number().int().min(1).max(5).optional(),
  mood: z.enum(["bad", "ok", "good"]).optional()
});

export const measurementsEventSchema = baseEventSchema.extend({
  type: z.literal("measurements"),
  values: z.object({
    weightKg: z.number().positive().optional(),
    waistCm: z.number().positive().optional(),
    abdomenCm: z.number().positive().optional(),
    chestCm: z.number().positive().optional(),
    neckCm: z.number().positive().optional(),
    hipsCm: z.number().positive().optional(),
    forearmCm: z.number().positive().optional(),
    leftBicepCm: z.number().positive().optional(),
    rightBicepCm: z.number().positive().optional(),
    leftBicepFlexedCm: z.number().positive().optional(),
    rightBicepFlexedCm: z.number().positive().optional(),
    leftThighCm: z.number().positive().optional(),
    rightThighCm: z.number().positive().optional(),
    leftCalfCm: z.number().positive().optional(),
    rightCalfCm: z.number().positive().optional()
  }).refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one measurement is required"
  })
});

/**
 * One reading from the sheet. Agents may send just `key` + `value` (+ reference range, evaluation, segment, frequency):
 * label, unit and category are filled from the catalog so tests stay comparable.
 */
export const inbodyMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1).optional(),
  value: z.number(),
  unit: z.string().optional(),
  referenceMin: z.number().optional(),
  referenceMax: z.number().optional(),
  segment: z.enum(INBODY_SEGMENTS).optional(),
  frequencyKhz: z.number().positive().optional(),
  // The sheet's own verdict for segmental lean/fat and for BMI/PBF.
  evaluation: z.enum(["under", "normal", "over"]).optional(),
  category: z.enum(INBODY_CATEGORIES).optional()
}).superRefine((metric, ctx) => {
  const definition = inBodyDefinition(metric.key);
  if (definition?.segmental && !metric.segment) {
    ctx.addIssue({ code: "custom", message: `${metric.key} needs a segment (left_arm, right_arm, trunk, left_leg or right_leg)`, path: ["segment"] });
  }
  if (definition?.frequency && !metric.frequencyKhz) {
    ctx.addIssue({ code: "custom", message: `${metric.key} needs frequencyKhz (20 or 100)`, path: ["frequencyKhz"] });
  }
}).transform((metric) => {
  const definition = inBodyDefinition(metric.key);
  const unit = metric.unit ?? definition?.unit;
  return {
    ...metric,
    label: metric.label ?? definition?.label ?? metric.key,
    ...(unit === undefined ? {} : { unit }),
    category: metric.category ?? definition?.category ?? ("other" as const)
  };
});

export const inbodyEventSchema = baseEventSchema.extend({
  type: z.literal("inbody"),
  source: z.object({
    assetId: z.string().uuid().optional(),
    url: z.string().optional(),
    mimeType: z.enum(["application/pdf", "image/heic", "image/heif", "image/jpeg", "image/png"]),
    fileName: z.string().min(1)
  }).refine((source) => source.assetId || source.url, {
    message: "InBody source requires a managed asset or display URL"
  }),
  metrics: z.array(inbodyMetricSchema).min(1).superRefine((metrics, ctx) => {
    const seen = new Set<string>();
    metrics.forEach((metric, index) => {
      const identity = inBodyMetricIdentity(metric);
      if (seen.has(identity)) {
        ctx.addIssue({ code: "custom", message: `Duplicate metric ${metric.key}${metric.segment ? ` (${metric.segment})` : ""}`, path: [index] });
      }
      seen.add(identity);
    });
  }),
  // Header of the printed sheet: which device, who it was measured for.
  report: z.object({
    device: z.string().min(1).optional(),
    testId: z.string().min(1).optional(),
    heightCm: z.number().positive().optional(),
    ageYears: z.number().int().positive().optional(),
    gender: z.enum(["male", "female"]).optional()
  }).optional(),
  extraction: z.object({
    method: z.enum(["mcp_agent", "local_ocr", "manual"]),
    reviewed: z.boolean()
  })
});

export const nutritionEntryEventSchema = baseEventSchema.extend({
  type: z.literal("nutrition_entry"),
  ...nutritionEntryPayloadSchema.shape
});

export const timelineEventSchema = z.discriminatedUnion("type", [
  progressPhotoEventSchema,
  workoutEventSchema,
  measurementsEventSchema,
  inbodyEventSchema,
  nutritionEntryEventSchema
]);

export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type NutritionEntryEvent = z.infer<typeof nutritionEntryEventSchema>;
export type InBodyMetric = z.infer<typeof inbodyMetricSchema>;
export type ProgressPhoto = z.infer<typeof progressPhotoEventSchema>["photos"][number];

export const taskScheduleSchema = z.object({
  id: z.string(),
  eventType: eventTypeSchema,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  intervalWeeks: z.number().int().min(1).max(52),
  enabled: z.boolean(),
  anchorDate: z.coerce.date()
});

export type TaskSchedule = z.infer<typeof taskScheduleSchema>;

/**
 * The event without signed media URLs (progress-photo urls, the InBody file link): agents rarely need them and each
 * pre-signed URL is long. Photos keep their ids, size and alt text, and `photoCount` says how many there are.
 */
export function redactMediaUrls<T extends TimelineEvent | undefined>(event: T): T {
  if (!event) return event;
  if (event.type === "progress_photo") {
    return {
      ...event,
      photoCount: event.photos.length,
      photos: event.photos.map((photo) => {
        const { url: _url, thumbnailUrl: _thumbnailUrl, ...rest } = photo;
        return rest;
      })
    } as unknown as T;
  }
  if (event.type === "inbody" && event.source && "url" in event.source && event.source.url) {
    const { url: _url, ...source } = event.source;
    return { ...event, source } as unknown as T;
  }
  return event;
}
