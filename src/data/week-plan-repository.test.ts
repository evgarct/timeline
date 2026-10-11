import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "week-plan-owner";

let plan: typeof import("./week-plan-repository");
let templates: typeof import("./workout-template-repository");
let exercises: typeof import("./exercise-repository");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  exercises = await import("./exercise-repository");
  templates = await import("./workout-template-repository");
  plan = await import("./week-plan-repository");
});

describe("week plan", () => {
  it("marks planned, done, missed, extra and free days (Monday first)", async () => {
    const press = await exercises.upsertExercise(userId, { name: "Week Press" });
    await templates.upsertTemplate(userId, {
      name: "Mon+Wed", schedule: { weekdays: [1, 3] }, exercises: [{ exerciseId: press.id, sets: 3 }]
    });
    // Monday 2026-10-05 trained, Tuesday 2026-10-06 extra session
    await exercises.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-10-05T09:00:00.000Z"), timezone: "UTC", muscleGroups: ["chest"],
      sets: [{ exerciseId: press.id, setIndex: 1, reps: 8, weightKg: 40 }]
    });
    await exercises.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-10-06T09:00:00.000Z"), timezone: "UTC", muscleGroups: ["chest"],
      sets: [{ exerciseId: press.id, setIndex: 1, reps: 8, weightKg: 40 }]
    });

    // "now" is Thursday: Wednesday was scheduled and not trained
    const week = await plan.getWeekPlan(userId, "2026-10-08", "UTC", new Date("2026-10-08T10:00:00.000Z"));
    expect(week.weekStart).toBe("2026-10-05");
    expect(week.days.map((day) => day.status)).toEqual(["done", "extra", "missed", "free", "free", "free", "free"]);
    expect(week.summary).toMatchObject({ plannedDays: 2, doneDays: 1, missedDays: 1, extraDays: 1 });
    expect(week.summary.unplannedDays).toHaveLength(5);

    const next = await plan.getWeekPlan(userId, "2026-10-12", "UTC", new Date("2026-10-08T10:00:00.000Z"));
    expect(next.days[0].status).toBe("planned");
  });
});
