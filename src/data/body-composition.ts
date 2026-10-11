import "server-only";
import { listDailyActivity } from "@/data/daily-activity-repository";
import { listRecentWorkoutSessions } from "@/data/exercise-repository";
import { listFoodEntriesInRange } from "@/data/nutrition-repository";
import { listEvents } from "@/data/repository";
import { buildBodyComposition, localDate, PHOTO_AFTER_DAYS, MEASUREMENT_WINDOW_DAYS, type BodyCompositionTest } from "@/domain/body-composition";
import { isInBodyEvent } from "@/domain/inbody";

const DAY_MS = 86_400_000;
const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export interface BodyCompositionQuery {
  from?: Date;
  to?: Date;
  /** Metric keys/refs (comma list in REST) or "all". Default: the trend set. */
  metrics?: "all" | string[];
  timezone: string;
}

/**
 * InBody tests oldest first with changes and the context around them: diet, steps and training between two tests, the
 * progress photos and tape measurements taken near them. A test range includes the test before `from` so the first
 * returned test still has its change since the previous one.
 */
export async function getBodyComposition(userId: string, query: BodyCompositionQuery): Promise<BodyCompositionTest[]> {
  const all = (await listEvents(userId, { type: "inbody" }, { hydrate: false })).filter(isInBodyEvent);
  if (!all.length) return [];
  const sorted = [...all].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const inRange = sorted.filter((event) => (!query.from || event.occurredAt >= query.from) && (!query.to || event.occurredAt <= query.to));
  if (!inRange.length) return [];
  const startIndex = sorted.indexOf(inRange[0]);
  // The earlier test supplies the deltas and the interval start of the first test in range.
  const events = sorted.slice(Math.max(0, startIndex - 1), sorted.indexOf(inRange[inRange.length - 1]) + 1);

  const firstDate = localDate(events[0].occurredAt, query.timezone);
  const lastDate = localDate(events[events.length - 1].occurredAt, query.timezone);
  const windowFrom = shiftDate(firstDate, -Math.max(PHOTO_AFTER_DAYS, MEASUREMENT_WINDOW_DAYS));
  const windowTo = shiftDate(lastDate, Math.max(PHOTO_AFTER_DAYS, MEASUREMENT_WINDOW_DAYS));
  const range = { from: new Date(`${windowFrom}T00:00:00Z`), to: new Date(`${windowTo}T23:59:59Z`) };

  const [photos, measurements, food, activity, workouts] = await Promise.all([
    listEvents(userId, { type: "progress_photo", ...range }, { hydrate: false }),
    listEvents(userId, { type: "measurements", ...range }, { hydrate: false }),
    listFoodEntriesInRange(userId, firstDate, lastDate, query.timezone),
    listDailyActivity(userId, firstDate, lastDate),
    listRecentWorkoutSessions(userId, 2000, { from: new Date(`${firstDate}T00:00:00Z`), to: new Date(`${lastDate}T23:59:59Z`) })
  ]);

  const tests = buildBodyComposition({
    events,
    photos: photos.map((event) => ({ id: event.id, occurredAt: event.occurredAt })),
    measurements: measurements.flatMap((event) => event.type === "measurements" ? [{ id: event.id, occurredAt: event.occurredAt, values: event.values }] : []),
    food: food.map((entry) => ({ occurredAt: entry.occurredAt, timezone: entry.timezone, nutrients: entry.productSnapshot.nutrients })),
    steps: activity.map((row) => ({ date: row.activityDate, steps: row.steps })),
    workouts: workouts.map((session) => ({ date: localDate(session.occurredAt, query.timezone), setCount: session.summary.setCount, tonnageKg: session.summary.tonnageKg })),
    timezone: query.timezone,
    metrics: query.metrics
  });
  // Drop the earlier test that was only fetched for context.
  const wantedIds = new Set(inRange.map((event) => event.id));
  return tests.filter((test) => wantedIds.has(test.id));
}
