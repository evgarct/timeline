import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "agent-repo-owner";

let exerciseRepo: typeof import("./exercise-repository");
let templateRepo: typeof import("./workout-template-repository");
let eventRepo: typeof import("./repository");
const ids: Record<string, string> = {};

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  exerciseRepo = await import("./exercise-repository");
  templateRepo = await import("./workout-template-repository");
  eventRepo = await import("./repository");

  const make = async (key: string, input: Parameters<typeof exerciseRepo.upsertExercise>[1]) => {
    ids[key] = (await exerciseRepo.upsertExercise(userId, input)).id;
  };
  await make("bench", { name: "Alt Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], movementPattern: "push", equipment: "barbell" });
  await make("dbPress", { name: "Alt Dumbbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], movementPattern: "push", equipment: "dumbbell" });
  await make("fly", { name: "Alt Cable Fly", primaryMuscles: ["chest"], movementPattern: "pull", equipment: "cable" });
  await make("squat", { name: "Alt Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], movementPattern: "squat", equipment: "barbell" });
});

describe("listExerciseAlternatives", () => {
  it("returns same-muscle exercises ranked by pattern, never the exercise itself or other muscles", async () => {
    const found = await exerciseRepo.listExerciseAlternatives(userId, ids.bench);
    expect(found?.items.map((item) => item.name)).toEqual(["Alt Dumbbell Press", "Alt Cable Fly"]);
  });

  it("returns compact entries without technique, photos or aliases", async () => {
    await exerciseRepo.upsertExercise(userId, { name: "Alt Compact Press", primaryMuscles: ["chest"], movementPattern: "push", equipment: "barbell", images: ["https://example.com/a.jpg"], instructions: ["Step one"] });
    const found = await exerciseRepo.listExerciseAlternatives(userId, ids.bench);
    const entries = [found!.exercise, ...found!.items];
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(["equipment", "id", "movementPattern", "muscleGroups", "name", "primaryMuscles", "secondaryMuscles"]);
      expect(entry).not.toHaveProperty("instructions");
      expect(entry).not.toHaveProperty("images");
      expect(entry).not.toHaveProperty("searchAliases");
    }
    expect(found!.items.find((item) => item.name === "Alt Compact Press")).toBeDefined();
  });

  it("honours an equipment constraint and reports an unknown exercise", async () => {
    const found = await exerciseRepo.listExerciseAlternatives(userId, ids.bench, { equipment: "cable" });
    expect(found?.items.map((item) => item.name)).toEqual(["Alt Cable Fly"]);
    expect(await exerciseRepo.listExerciseAlternatives(userId, "00000000-0000-4000-8000-000000000000")).toBeUndefined();
  });
});

describe("previewTemplateVolume", () => {
  it("counts primary 1 and secondary 0.5 per set and lists unknown exercises", async () => {
    const preview = await exerciseRepo.previewTemplateVolume(userId, [
      { exerciseId: ids.bench, sets: 4 }, { exerciseId: ids.squat, sets: 3 }, { exerciseId: "00000000-0000-4000-8000-000000000001", sets: 2 }
    ]);
    expect(preview.totalSets).toBe(7);
    expect(preview.byMuscle).toEqual({ chest: 4, triceps: 2, shoulders: 2, quads: 3, glutes: 1.5 });
    expect(preview.missing).toEqual(["00000000-0000-4000-8000-000000000001"]);
  });
});

describe("duplicateTemplate", () => {
  it("copies the prescription under a free name each time", async () => {
    const original = await templateRepo.upsertTemplate(userId, { name: "Dup Push", exercises: [{ exerciseId: ids.bench, sets: 4, repMin: 6, repMax: 8 }], isArchived: false });
    const first = await templateRepo.duplicateTemplate(userId, original.id);
    const second = await templateRepo.duplicateTemplate(userId, original.id);
    const named = await templateRepo.duplicateTemplate(userId, original.id, "Heavy push");

    expect(first?.name).toBe("Dup Push (copy)");
    expect(second?.name).toBe("Dup Push (copy 2)");
    expect(named?.name).toBe("Heavy push");
    expect(first?.id).not.toBe(original.id);
    expect(first?.exercises).toEqual(original.exercises);
    expect(await templateRepo.duplicateTemplate(userId, "00000000-0000-4000-8000-000000000002")).toBeUndefined();
  });
});

describe("listEvents filters", () => {
  it("filters by type and window, newest first, with paging", async () => {
    const base = { timezone: "UTC", completed: true, muscleGroups: ["chest"] };
    for (const [id, day] of [["11111111-1111-4111-8111-111111111111", "2031-03-01"], ["22222222-2222-4222-8222-222222222222", "2031-03-05"], ["33333333-3333-4333-8333-333333333333", "2031-03-09"]]) {
      await eventRepo.createEvent(userId, { ...base, id, type: "workout", occurredAt: new Date(`${day}T10:00:00Z`) } as never);
    }
    await eventRepo.createEvent(userId, { id: "44444444-4444-4444-8444-444444444444", type: "measurements", occurredAt: new Date("2031-03-06T10:00:00Z"), timezone: "UTC", values: { weightKg: 80 } } as never);

    const window = { from: new Date("2031-03-01T00:00:00Z"), to: new Date("2031-03-10T00:00:00Z") };
    const workouts = await eventRepo.listEvents(userId, { ...window, type: "workout" });
    expect(workouts.map((event) => event.id.slice(0, 2))).toEqual(["33", "22", "11"]);

    const paged = await eventRepo.listEvents(userId, { ...window, type: "workout", limit: 1, offset: 1 });
    expect(paged.map((event) => event.id.slice(0, 2))).toEqual(["22"]);

    const narrow = await eventRepo.listEvents(userId, { from: new Date("2031-03-05T00:00:00Z"), to: new Date("2031-03-06T23:59:59Z") });
    expect(narrow.map((event) => event.id.slice(0, 2))).toEqual(["44", "22"]);
  });
});

describe("listRecentWorkoutSessions range", () => {
  it("returns only sessions inside the window", async () => {
    for (const day of ["2032-05-01", "2032-05-08", "2032-05-15"]) {
      await exerciseRepo.recordWorkoutSession(userId, {
        occurredAt: new Date(`${day}T10:00:00Z`), timezone: "UTC", muscleGroups: ["chest"],
        sets: [{ exerciseId: ids.bench, setIndex: 1, reps: 8, weightKg: 60, completed: true, setType: "working" }]
      });
    }
    const sessions = await exerciseRepo.listRecentWorkoutSessions(userId, 50, { from: new Date("2032-05-02T00:00:00Z"), to: new Date("2032-05-10T23:59:59Z") });
    expect(sessions.map((session) => session.occurredAt.toISOString().slice(0, 10))).toEqual(["2032-05-08"]);
  });
});
