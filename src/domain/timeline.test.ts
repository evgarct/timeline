import { describe, expect, it } from "vitest";
import { seedEvents, seedSchedules } from "@/data/seed";
import { groupEventsByDay, isFresh, isScheduleDue, isTaskCompleted, latestEvent } from "./timeline";

describe("timeline domain", () => {
  it("groups events in reverse chronological days", () => {
    const groups = groupEventsByDay(seedEvents);
    expect(Object.keys(groups).length).toBeGreaterThan(1);
    expect(Object.values(groups).flat()).toHaveLength(seedEvents.length);
  });

  it("returns the latest event for a type", () => {
    expect(latestEvent(seedEvents, "progress_photo")?.type).toBe("progress_photo");
  });

  it("treats data older than 30 days as stale", () => {
    expect(isFresh(seedEvents[0], new Date(seedEvents[0].occurredAt.getTime() + 31 * 86_400_000))).toBe(false);
  });

  it("requires a saved event to complete a task", () => {
    expect(isTaskCompleted("workout", seedEvents, seedEvents[0].occurredAt)).toBe(true);
    expect(isTaskCompleted("inbody", seedEvents, seedEvents[0].occurredAt)).toBe(false);
  });

  it("evaluates weekly schedules from the anchor", () => {
    const schedule = { ...seedSchedules[0], weekdays: [new Date().getDay()] };
    expect(isScheduleDue(schedule)).toBe(true);
  });
});

