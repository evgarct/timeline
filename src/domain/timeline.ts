import { differenceInCalendarDays, differenceInCalendarWeeks, format } from "date-fns";
import type { EventType, TaskSchedule, TimelineEvent } from "./events";

export function groupEventsByDay(events: TimelineEvent[]) {
  return [...events]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .reduce<Record<string, TimelineEvent[]>>((groups, event) => {
      const key = format(event.occurredAt, "yyyy-MM-dd");
      groups[key] ??= [];
      groups[key].push(event);
      return groups;
    }, {});
}

export function isFresh(event: TimelineEvent | undefined, now = new Date(), maxAgeDays = 30) {
  return Boolean(event && differenceInCalendarDays(now, event.occurredAt) <= maxAgeDays);
}

export function latestEvent(events: TimelineEvent[], type: EventType) {
  return events
    .filter((event) => event.type === type)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];
}

export function isScheduleDue(schedule: TaskSchedule, date = new Date()) {
  if (!schedule.enabled || !schedule.weekdays.includes(date.getDay())) return false;
  const elapsed = Math.abs(differenceInCalendarWeeks(date, schedule.anchorDate, { weekStartsOn: 1 }));
  return elapsed % schedule.intervalWeeks === 0;
}

export function isTaskCompleted(type: EventType, events: TimelineEvent[], date = new Date()) {
  const day = format(date, "yyyy-MM-dd");
  return events.some((event) => event.type === type && format(event.occurredAt, "yyyy-MM-dd") === day);
}

