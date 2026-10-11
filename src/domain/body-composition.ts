import type { InBodyMetric } from "./events";
import { INBODY_TREND_KEYS, inBodyMetricIdentity } from "./inbody-catalog";
import { isInBodyEvent, sortInBodyTests, type InBodyEvent } from "./inbody";
import { canonicalMacroKeys } from "./nutrition";

/**
 * Body composition over time: every InBody test with its values, the change since the previous and the first test, and
 * what happened between two tests (diet, steps, training, progress photos, tape measurements). Pure, so the server,
 * Studio and tests share one definition; the loader that fetches the inputs is `src/data/body-composition.ts`.
 */

export interface BodyMetricReading {
  /** `key`, `key:segment` or `key:segment@frequency`, unique within a test. */
  ref: string;
  key: string;
  label: string;
  unit?: string;
  category: InBodyMetric["category"];
  segment?: InBodyMetric["segment"];
  frequencyKhz?: number;
  value: number;
  referenceMin?: number;
  referenceMax?: number;
  evaluation?: InBodyMetric["evaluation"];
  deltaFromPrevious?: number;
  deltaFromFirst?: number;
}

export interface BodyInterval {
  /** Local dates (YYYY-MM-DD): from the previous test's day up to the day before this test. */
  fromDate: string;
  toDate: string;
  days: number;
  nutrition: null | { loggedDays: number; avgKcal?: number; avgProteinG?: number; avgFatG?: number; avgCarbsG?: number };
  steps: null | { days: number; avgSteps: number };
  workouts: { count: number; setCount: number; tonnageKg: number };
}

export interface BodyNearbyPhoto { eventId: string; date: string; daysFromTest: number }

export interface BodyNearbyMeasurement { eventId: string; date: string; daysFromTest: number; values: Record<string, number> }

export interface BodyCompositionTest {
  id: string;
  occurredAt: string;
  /** Local date of the test (YYYY-MM-DD). */
  date: string;
  timezone: string;
  note?: string;
  hasOriginal: boolean;
  /** The stored original sheet; `/api/media/<id>?inline=1` opens it for the signed-in owner. */
  originalAssetId?: string;
  extraction: InBodyEvent["extraction"];
  report?: InBodyEvent["report"];
  metrics: BodyMetricReading[];
  /** Null for the first test. */
  interval: BodyInterval | null;
  /** Progress photos from the previous test to this one, plus any within a week after it. */
  photos: BodyNearbyPhoto[];
  measurement?: BodyNearbyMeasurement;
}

export interface BodyCompositionInputs {
  events: InBodyEvent[];
  photos: Array<{ id: string; occurredAt: Date }>;
  measurements: Array<{ id: string; occurredAt: Date; values: Record<string, number | undefined> }>;
  /** Food entries with their nutrient snapshot (already scaled to the eaten amount). */
  food: Array<{ occurredAt: Date; timezone: string; nutrients: ReadonlyArray<{ key?: string; value?: number }> }>;
  /** Daily step counts keyed by local date. */
  steps: Array<{ date: string; steps: number }>;
  workouts: Array<{ date: string; setCount: number; tonnageKg: number }>;
  timezone: string;
  /** Metric refs/keys to return per test; "all" returns every reading on the sheet. Default: the trend set. */
  metrics?: "all" | string[];
}

export const PHOTO_AFTER_DAYS = 7;
export const MEASUREMENT_WINDOW_DAYS = 14;

export function localDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY_MS);
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export function metricRef(metric: { key: string; segment?: string; frequencyKhz?: number }) {
  return `${metric.key}${metric.segment ? `:${metric.segment}` : ""}${metric.frequencyKhz ? `@${metric.frequencyKhz}` : ""}`;
}

export function parseMetricsParam(value: string | undefined): "all" | string[] | undefined {
  if (!value?.trim()) return undefined;
  if (value.trim() === "all") return "all";
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function wanted(metric: InBodyMetric, filter: "all" | string[]) {
  if (filter === "all") return true;
  return filter.includes(metricRef(metric)) || filter.includes(metric.key);
}

function dailyTotals(food: BodyCompositionInputs["food"], timezone: string) {
  const days = new Map<string, { kcal: number; protein: number; fat: number; carbs: number; hasKcal: boolean }>();
  for (const entry of food) {
    const date = localDate(entry.occurredAt, timezone);
    const day = days.get(date) ?? { kcal: 0, protein: 0, fat: 0, carbs: 0, hasKcal: false };
    const find = (key: string) => entry.nutrients.find((nutrient) => nutrient.key === key)?.value;
    const kcal = find(canonicalMacroKeys.energy);
    if (kcal !== undefined) day.hasKcal = true;
    day.kcal += kcal ?? 0;
    day.protein += find(canonicalMacroKeys.protein) ?? 0;
    day.fat += find(canonicalMacroKeys.fat) ?? 0;
    day.carbs += find(canonicalMacroKeys.carbohydrates) ?? 0;
    days.set(date, day);
  }
  return days;
}

export function buildBodyComposition(input: BodyCompositionInputs): BodyCompositionTest[] {
  const filter = input.metrics ?? [...INBODY_TREND_KEYS];
  const tests = sortInBodyTests(input.events.filter(isInBodyEvent));
  const food = dailyTotals(input.food, input.timezone);
  const photos = input.photos.map((photo) => ({ id: photo.id, date: localDate(photo.occurredAt, input.timezone) }));
  const measurements = input.measurements.map((item) => ({
    id: item.id,
    date: localDate(item.occurredAt, input.timezone),
    values: Object.fromEntries(Object.entries(item.values).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
  }));

  const readings = (event: InBodyEvent) => new Map(event.metrics.map((metric) => [inBodyMetricIdentity(metric), metric]));
  const first = tests[0] ? readings(tests[0]) : new Map<string, InBodyMetric>();

  return tests.map((event, index): BodyCompositionTest => {
    const timezone = event.timezone || input.timezone;
    const date = localDate(event.occurredAt, input.timezone);
    const previous = index > 0 ? tests[index - 1] : undefined;
    const previousReadings = previous ? readings(previous) : undefined;
    const previousDate = previous ? localDate(previous.occurredAt, input.timezone) : undefined;

    const metrics = event.metrics.filter((metric) => wanted(metric, filter)).map((metric): BodyMetricReading => {
      const identity = inBodyMetricIdentity(metric);
      const before = previousReadings?.get(identity)?.value;
      const start = index > 0 ? first.get(identity)?.value : undefined;
      return {
        ref: metricRef(metric),
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        category: metric.category,
        segment: metric.segment,
        frequencyKhz: metric.frequencyKhz,
        value: metric.value,
        referenceMin: metric.referenceMin,
        referenceMax: metric.referenceMax,
        evaluation: metric.evaluation,
        deltaFromPrevious: before === undefined ? undefined : round(metric.value - before),
        deltaFromFirst: start === undefined ? undefined : round(metric.value - start)
      };
    });

    let interval: BodyInterval | null = null;
    if (previousDate) {
      const toDate = date;
      const days = daysBetween(previousDate, toDate);
      // The previous test's day counts (the food after the morning test), the day of this test does not.
      const inRange = (value: string) => value >= previousDate && value < toDate;
      const dietDays = [...food.entries()].filter(([day]) => inRange(day)).map(([, totals]) => totals);
      const kcalDays = dietDays.filter((day) => day.hasKcal);
      const average = (values: number[]) => (values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 1) : undefined);
      const stepDays = input.steps.filter((day) => inRange(day.date) && day.steps > 0);
      const trained = input.workouts.filter((workout) => inRange(workout.date));
      interval = {
        fromDate: previousDate,
        toDate,
        days,
        nutrition: dietDays.length
          ? {
              loggedDays: dietDays.length,
              avgKcal: average(kcalDays.map((day) => day.kcal)),
              avgProteinG: average(dietDays.map((day) => day.protein)),
              avgFatG: average(dietDays.map((day) => day.fat)),
              avgCarbsG: average(dietDays.map((day) => day.carbs))
            }
          : null,
        steps: stepDays.length ? { days: stepDays.length, avgSteps: Math.round(stepDays.reduce((sum, day) => sum + day.steps, 0) / stepDays.length) } : null,
        workouts: {
          count: trained.length,
          setCount: trained.reduce((sum, workout) => sum + workout.setCount, 0),
          tonnageKg: Math.round(trained.reduce((sum, workout) => sum + workout.tonnageKg, 0))
        }
      };
    }

    const nearbyPhotos = photos
      .map((photo) => ({ eventId: photo.id, date: photo.date, daysFromTest: daysBetween(date, photo.date) }))
      .filter((photo) => {
        const afterPrevious = previousDate ? photo.date > previousDate : photo.daysFromTest >= -PHOTO_AFTER_DAYS;
        return afterPrevious && photo.daysFromTest <= PHOTO_AFTER_DAYS;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const nearest = measurements
      .map((item) => ({ eventId: item.id, date: item.date, daysFromTest: daysBetween(date, item.date), values: item.values }))
      .filter((item) => Math.abs(item.daysFromTest) <= MEASUREMENT_WINDOW_DAYS)
      .sort((a, b) => Math.abs(a.daysFromTest) - Math.abs(b.daysFromTest))[0];

    return {
      id: event.id,
      occurredAt: event.occurredAt.toISOString(),
      date,
      timezone,
      note: event.note,
      hasOriginal: Boolean(event.source.assetId || event.source.url),
      originalAssetId: event.source.assetId,
      extraction: event.extraction,
      report: event.report,
      metrics,
      interval,
      photos: nearbyPhotos,
      measurement: nearest
    };
  });
}

const signed = (value: number | undefined, digits = 1) =>
  value === undefined ? "" : ` (${value > 0 ? "+" : ""}${round(value, digits)})`;

/** Plain-text view for agents: headline metrics with changes per test, then what happened in each interval. */
export function bodyCompositionText(tests: BodyCompositionTest[]) {
  if (!tests.length) return "No InBody tests in this range.";
  const lines = [`${tests.length} InBody tests, oldest first (value (change since previous test)); intervals describe the time since the previous test:`];
  for (const test of tests) {
    const values = test.metrics
      .filter((metric) => !metric.segment)
      .map((metric) => `${metric.key} ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}${signed(metric.deltaFromPrevious)}`)
      .join(", ");
    lines.push(`${test.date} (id ${test.id}${test.hasOriginal ? ", original file attached" : ""}${test.extraction.reviewed ? "" : ", values not yet reviewed"}): ${values}`);
    // Only present when the caller asked for every reading (metrics=all).
    const segments = test.metrics.filter((metric) => metric.segment);
    if (segments.length) {
      lines.push(`  per segment: ${segments.map((metric) => `${metric.ref} ${metric.value}${metric.evaluation ? ` ${metric.evaluation}` : ""}${signed(metric.deltaFromPrevious, 2)}`).join("; ")}`);
    }
    const interval = test.interval;
    if (interval) {
      const parts = [`${interval.days} days since ${interval.fromDate}`];
      if (interval.nutrition) {
        const n = interval.nutrition;
        parts.push(`diet logged ${n.loggedDays}/${interval.days} days: avg ${n.avgKcal !== undefined ? `${Math.round(n.avgKcal)} kcal, ` : ""}${n.avgProteinG ?? "?"} g protein, ${n.avgFatG ?? "?"} g fat, ${n.avgCarbsG ?? "?"} g carbs per logged day`);
      } else parts.push("no diet logged");
      parts.push(interval.steps ? `steps avg ${interval.steps.avgSteps}/day (${interval.steps.days} days)` : "no step data");
      parts.push(`${interval.workouts.count} workouts, ${interval.workouts.setCount} sets, ${interval.workouts.tonnageKg} kg tonnage`);
      lines.push(`  between: ${parts.join("; ")}`);
    }
    if (test.photos.length) lines.push(`  progress photos: ${test.photos.map((photo) => `${photo.date} (event ${photo.eventId}, ${photo.daysFromTest >= 0 ? "+" : ""}${photo.daysFromTest}d)`).join(", ")}`);
    if (test.measurement) {
      const values = Object.entries(test.measurement.values).map(([key, value]) => `${key} ${value}`).join(", ");
      lines.push(`  tape measurements ${test.measurement.date} (${test.measurement.daysFromTest >= 0 ? "+" : ""}${test.measurement.daysFromTest}d): ${values}`);
    }
  }
  return lines.join("\n");
}
