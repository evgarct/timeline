import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "template-owner";

let templates: typeof import("./workout-template-repository");
let exercises: typeof import("./exercise-repository");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  exercises = await import("./exercise-repository");
  templates = await import("./workout-template-repository");
});

describe("memory workout template repository", () => {
  it("creates a template, reuses it by exact name and keeps it owner-scoped", async () => {
    const bench = await exercises.upsertExercise(userId, { name: "Template Bench" });
    const created = await templates.upsertTemplate(userId, {
      name: "Push A",
      exercises: [{ exerciseId: bench.id, sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 }]
    });
    const reused = await templates.upsertTemplate(userId, {
      name: "push a",
      note: "heavy day",
      exercises: [{ exerciseId: bench.id, sets: 4 }]
    });

    expect(reused.id).toBe(created.id);
    expect(reused.exercises[0].sets).toBe(4);
    expect((await templates.listTemplates(userId)).filter((item) => item.name.toLowerCase() === "push a")).toHaveLength(1);
    expect(await templates.getTemplate("someone-else", created.id)).toBeUndefined();
    expect(await templates.listTemplates("someone-else")).toEqual([]);
  });

  it("rejects a template that references an unknown exercise", async () => {
    await expect(templates.upsertTemplate(userId, {
      name: "Ghost", exercises: [{ exerciseId: "6f1c1c4e-3b6e-4b6b-8f0e-2a4f5f9d7a11" }]
    })).rejects.toThrow("unknown_exercise");
  });

  it("ignores incomplete sets when planning, so an unfinished top set cannot change the suggestion", async () => {
    const squat = await exercises.upsertExercise(userId, { name: "Template Squat" });
    await exercises.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-22T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["quads"],
      sets: [
        { exerciseId: squat.id, setIndex: 1, reps: 8, weightKg: 100 },
        { exerciseId: squat.id, setIndex: 2, reps: 8, weightKg: 100 },
        { exerciseId: squat.id, setIndex: 3, reps: 3, weightKg: 120, completed: false }
      ]
    });
    const template = await templates.upsertTemplate(userId, {
      name: "Squat day",
      exercises: [{ exerciseId: squat.id, repMin: 5, repMax: 8, progression: { type: "double", incrementKg: 5 } }]
    });

    const plan = await templates.planTemplate(userId, template.id);
    expect(plan?.exercises[0].lastSets).toEqual([{ reps: 8, weightKg: 100 }, { reps: 8, weightKg: 100 }]);
    expect(plan?.exercises[0].suggestion).toEqual({ weightKg: 105, reason: "increase" });
    expect((await exercises.getExerciseHistory(userId, squat.id)).bestSet?.weightKg).toBe(100);
  });

  it("uses the planned weight when there is no history, and lets the progression rule take over once there is", async () => {
    const curl = await exercises.upsertExercise(userId, { name: "Planned Curl" });
    const template = await templates.upsertTemplate(userId, {
      name: "Arms",
      exercises: [{ exerciseId: curl.id, sets: 3, repMin: 8, repMax: 12, weightKg: 20, progression: { type: "double", incrementKg: 1 } }]
    });

    const first = await templates.planTemplate(userId, template.id);
    expect(first?.exercises[0].suggestion).toEqual({ weightKg: 20, reason: "planned" });

    await exercises.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-24T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["biceps"],
      sets: [1, 2, 3].map((index) => ({ exerciseId: curl.id, setIndex: index, reps: 12, weightKg: 20 }))
    });
    const second = await templates.planTemplate(userId, template.id);
    expect(second?.exercises[0].suggestion).toEqual({ weightKg: 21, reason: "increase" });
  });

  it("prefers an explicit planned weight over history when there is no progression rule", async () => {
    const row = await exercises.upsertExercise(userId, { name: "Planned Row" });
    await exercises.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-25T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["lats"],
      sets: [{ exerciseId: row.id, setIndex: 1, reps: 10, weightKg: 50 }]
    });
    const template = await templates.upsertTemplate(userId, {
      name: "Back", exercises: [{ exerciseId: row.id, weightKg: 55 }]
    });
    expect((await templates.planTemplate(userId, template.id))?.exercises[0].suggestion).toEqual({ weightKg: 55, reason: "planned" });
  });

  it("hides archived templates by default and deletes", async () => {
    const lift = await exercises.upsertExercise(userId, { name: "Template Row" });
    const template = await templates.upsertTemplate(userId, { name: "Pull B", exercises: [{ exerciseId: lift.id }] });
    await templates.upsertTemplate(userId, { id: template.id, name: "Pull B", exercises: [{ exerciseId: lift.id }], isArchived: true });

    expect((await templates.listTemplates(userId)).some((item) => item.id === template.id)).toBe(false);
    expect((await templates.listTemplates(userId, true)).some((item) => item.id === template.id)).toBe(true);
    expect(await templates.deleteTemplate(userId, template.id)).toBe(true);
    expect(await templates.deleteTemplate(userId, template.id)).toBe(false);
  });

  it("plans the next session: last sets plus a double-progression load suggestion", async () => {
    const press = await exercises.upsertExercise(userId, { name: "Template Press", primaryMuscles: ["shoulders"] });
    await exercises.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-20T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["shoulders"],
      sets: [
        { exerciseId: press.id, setIndex: 1, reps: 8, weightKg: 30, setType: "warmup" },
        { exerciseId: press.id, setIndex: 2, reps: 10, weightKg: 40 },
        { exerciseId: press.id, setIndex: 3, reps: 10, weightKg: 40 }
      ]
    });
    const template = await templates.upsertTemplate(userId, {
      name: "Shoulders",
      exercises: [
        { exerciseId: press.id, sets: 3, repMin: 6, repMax: 10, targetRir: 2, progression: { type: "double", incrementKg: 2.5 } }
      ]
    });

    const plan = await templates.planTemplate(userId, template.id);
    expect(plan?.exercises[0]).toMatchObject({
      name: "Template Press",
      primaryMuscles: ["shoulders"],
      lastSets: [{ reps: 10, weightKg: 40 }, { reps: 10, weightKg: 40 }],
      suggestion: { weightKg: 42.5, reason: "increase" }
    });
    expect(await templates.planTemplate("someone-else", template.id)).toBeUndefined();
  });
});
