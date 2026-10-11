import "server-only";
import { listRecentWorkoutSessions } from "@/data/exercise-repository";
import { listTemplates } from "@/data/workout-template-repository";
import { isScheduledOn } from "@/domain/workout-templates";
import { isValidTimeZone } from "@/domain/exercises";

export type DayStatus = "planned" | "done" | "missed" | "extra" | "free";

export interface WeekPlanDay {
  date: string;
  /** JavaScript weekday: 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  scheduled: Array<{ templateId: string; name: string }>;
  sessions: Array<{ eventId: string; occurredAt: Date; muscleGroups: string[]; setCount: number; tonnageKg: number }>;
  /**
   * planned: something is scheduled and still ahead (or today); done: a session was logged on a scheduled day;
   * missed: scheduled in the past with no session; extra: a session on a day with nothing scheduled;
   * free: nothing scheduled and nothing logged.
   */
  status: DayStatus;
}

const dayKeyIn = (date: Date, timezone: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: isValidTimeZone(timezone) ? timezone : "UTC", year: "numeric", month: "2-digit", day: "2-digit"
}).format(date);

export const mondayOfDate = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

/**
 * The week (Monday first) of the user's training: which templates are scheduled on which day (from their `schedule`),
 * what was actually logged, and which days have no plan. Days are the user's calendar days in `timezone`; each logged
 * session counts on the day of its own timezone.
 */
export async function getWeekPlan(userId: string, weekStartInput: string | undefined, timezone: string, now = new Date()) {
  const zone = isValidTimeZone(timezone) ? timezone : "UTC";
  const today = dayKeyIn(now, zone);
  const weekStart = mondayOfDate(weekStartInput ?? today);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

  const templates = (await listTemplates(userId)).filter((template) => template.schedule);
  const from = new Date(new Date(`${dates[0]}T00:00:00Z`).getTime() - 14 * 3600 * 1000);
  const to = new Date(new Date(`${dates[6]}T23:59:59Z`).getTime() + 14 * 3600 * 1000);
  const sessions = (await listRecentWorkoutSessions(userId, 200, { from, to }))
    .filter((session) => dates.includes(dayKeyIn(session.occurredAt, zone)));

  const days: WeekPlanDay[] = dates.map((date) => {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const scheduled = templates.filter((template) => isScheduledOn(template.schedule, date, weekday)).map((template) => ({ templateId: template.id, name: template.name }));
    const logged = sessions.filter((session) => dayKeyIn(session.occurredAt, zone) === date).map((session) => ({
      eventId: session.eventId, occurredAt: session.occurredAt, muscleGroups: session.muscleGroups,
      setCount: session.summary.setCount, tonnageKg: session.summary.tonnageKg
    }));
    const status: DayStatus = scheduled.length
      ? logged.length ? "done" : date < today ? "missed" : "planned"
      : logged.length ? "extra" : "free";
    return { date, weekday, scheduled, sessions: logged, status };
  });

  return {
    weekStart,
    timezone: zone,
    today,
    days,
    summary: {
      plannedDays: days.filter((day) => day.scheduled.length).length,
      doneDays: days.filter((day) => day.status === "done").length,
      missedDays: days.filter((day) => day.status === "missed").length,
      extraDays: days.filter((day) => day.status === "extra").length,
      /** Days with no plan at all: the "which weekdays are not planned" answer. */
      unplannedDays: days.filter((day) => !day.scheduled.length).map((day) => day.date)
    }
  };
}
