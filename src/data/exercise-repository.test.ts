import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "lifter-owner";
const otherUserId = "other-owner";

let repository: typeof import("./exercise-repository");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  repository = await import("./exercise-repository");
});

describe("memory exercise repository", () => {
  it("upserts by exact normalized name and keeps exercises owner-scoped", async () => {
    const created = await repository.upsertExercise(userId, { name: "Bench Press" });
    const reused = await repository.upsertExercise(userId, { name: "bench press", muscleGroups: ["chest"] });
    const other = await repository.upsertExercise(otherUserId, { name: "Bench Press" });

    expect(reused.id).toBe(created.id);
    expect(reused.muscleGroups).toEqual(["chest"]);
    expect(other.id).not.toBe(created.id);
    expect(await repository.getExercise(otherUserId, created.id)).toBeUndefined();
  });

  it("reuses an exact externalRef match without touching normalized-name matching", async () => {
    const created = await repository.upsertExercise(userId, {
      name: "Incline DB Press",
      externalRef: { source: "trainero", id: "10529" }
    });
    const reused = await repository.upsertExercise(userId, {
      name: "Incline Dumbbell Press (renamed)",
      externalRef: { source: "trainero", id: "10529" }
    });

    expect(reused.id).toBe(created.id);
    expect(reused.name).toBe("Incline Dumbbell Press (renamed)");
  });

  it("refuses to guess between two exact normalized-name matches", async () => {
    await repository.upsertExercise(userId, { name: "Squat", externalRef: { source: "trainero", id: "1" } });
    await repository.upsertExercise(userId, { name: "Squat", externalRef: { source: "trainero", id: "2" } });

    await expect(repository.upsertExercise(userId, { name: "Squat" })).rejects.toThrow("ambiguous_exercise");
  });

  it("records a workout session with its sets, idempotently, scoped to a local day", async () => {
    const exercise = await repository.upsertExercise(userId, { name: "Deadlift" });
    const input = {
      occurredAt: new Date("2026-09-15T18:00:00.000Z"),
      timezone: "Europe/Prague",
      muscleGroups: ["back", "legs"],
      sets: [
        { exerciseId: exercise.id, setIndex: 1, reps: 5, weightKg: 100, completed: true },
        { exerciseId: exercise.id, setIndex: 2, reps: 5, weightKg: 102.5, completed: true }
      ],
      idempotencyKey: "trainero-sync:2026-09-15"
    };

    const first = await repository.recordWorkoutSession(userId, input);
    const retry = await repository.recordWorkoutSession(userId, input);

    expect(retry.eventId).toBe(first.eventId);
    expect(first.summary).toEqual({ setCount: 2, exerciseCount: 1, tonnageKg: 1012.5 });

    const sessions = await repository.getWorkoutsForDate(userId, "2026-09-15", "Europe/Prague");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].exercises).toHaveLength(1);
    expect(sessions[0].exercises[0].name).toBe("Deadlift");
    expect(sessions[0].exercises[0].sets).toMatchObject([
      { setIndex: 1, reps: 5, weightKg: 100, setType: "working", completed: true },
      { setIndex: 2, reps: 5, weightKg: 102.5, setType: "working", completed: true }
    ]);
    expect(await repository.getWorkoutsForDate(otherUserId, "2026-09-15", "Europe/Prague")).toHaveLength(0);
  });

  it("reports best set and recent-session history for an exercise", async () => {
    const exercise = await repository.upsertExercise(userId, { name: "Overhead Press" });
    await repository.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-08-01T18:00:00.000Z"),
      timezone: "Europe/Prague",
      muscleGroups: ["shoulders"],
      sets: [{ exerciseId: exercise.id, setIndex: 1, reps: 5, weightKg: 40, completed: true }],
      idempotencyKey: "ohp-session-1"
    });
    await repository.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-08-08T18:00:00.000Z"),
      timezone: "Europe/Prague",
      muscleGroups: ["shoulders"],
      sets: [{ exerciseId: exercise.id, setIndex: 1, reps: 5, weightKg: 42.5, completed: true }],
      idempotencyKey: "ohp-session-2"
    });

    const history = await repository.getExerciseHistory(userId, exercise.id, 8);
    expect(history.bestSet?.weightKg).toBe(42.5);
    expect(history.windowSessions).toBe(2);
  });

  it("rejects sets that reference an unknown exercise", async () => {
    await expect(repository.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-20T10:00:00.000Z"),
      timezone: "Europe/Prague",
      muscleGroups: ["chest"],
      sets: [{ exerciseId: "6f1c1c4e-3b6e-4b6b-8f0e-2a4f5f9d7a11", setIndex: 1, reps: 5, weightKg: 50 }]
    })).rejects.toThrow("unknown_exercise");
  });

  it("stores RIR, set type and superset group; warm-ups never count toward bests or tonnage", async () => {
    const exercise = await repository.upsertExercise(userId, {
      name: "Barbell Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], movementPattern: "pull"
    });
    const session = await repository.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-22T09:00:00.000Z"),
      timezone: "Europe/Prague",
      muscleGroups: ["back"],
      sets: [
        { exerciseId: exercise.id, setIndex: 1, reps: 10, weightKg: 100, setType: "warmup" },
        { exerciseId: exercise.id, setIndex: 2, reps: 8, weightKg: 60, rir: 2, groupId: "ss1" }
      ]
    });

    expect(session.summary.tonnageKg).toBe(480);
    expect(session.sets[1]).toMatchObject({ rir: 2, groupId: "ss1", setType: "working" });
    const history = await repository.getExerciseHistory(userId, exercise.id);
    expect(history.bestSet?.weightKg).toBe(60);
    expect(history.bestE1rmKg).toBe(76);
    expect((await repository.getExercise(userId, exercise.id))?.movementPattern).toBe("pull");
  });

  it("returns stored fields on an idempotent retry, replaces sets and deletes a session", async () => {
    const exercise = await repository.upsertExercise(userId, { name: "Leg Press" });
    const base = {
      occurredAt: new Date("2026-09-25T09:00:00.000Z"),
      timezone: "Europe/Prague",
      muscleGroups: ["legs"],
      sets: [{ exerciseId: exercise.id, setIndex: 1, reps: 10, weightKg: 150 }],
      idempotencyKey: "leg-press-1"
    };
    const first = await repository.recordWorkoutSession(userId, base);
    const retry = await repository.recordWorkoutSession(userId, { ...base, muscleGroups: ["back"], timezone: "UTC" });
    expect(retry.muscleGroups).toEqual(["legs"]);
    expect(retry.timezone).toBe("Europe/Prague");

    const replaced = await repository.replaceWorkoutSession(userId, first.eventId, {
      ...base,
      sets: [
        { exerciseId: exercise.id, setIndex: 1, reps: 12, weightKg: 150 },
        { exerciseId: exercise.id, setIndex: 2, reps: 10, weightKg: 160 }
      ]
    });
    expect(replaced?.sets).toHaveLength(2);
    expect((await repository.getWorkoutSession(userId, first.eventId))?.sets).toHaveLength(2);
    expect(await repository.replaceWorkoutSession(otherUserId, first.eventId, base)).toBeUndefined();

    expect(await repository.deleteWorkoutSession(userId, first.eventId)).toBe(true);
    expect(await repository.getWorkoutSession(userId, first.eventId)).toBeUndefined();
    expect((await repository.getExerciseHistory(userId, exercise.id)).windowSessions).toBe(0);
  });

  it("lists recent sessions newest-first with exercise names, owner-scoped", async () => {
    const owner = "recent-owner";
    const squat = await repository.upsertExercise(owner, { name: "Front Squat" });
    const press = await repository.upsertExercise(owner, { name: "Strict Press" });
    await repository.recordWorkoutSession(owner, {
      occurredAt: new Date("2026-10-01T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["quads"],
      sets: [{ exerciseId: squat.id, setIndex: 1, reps: 5, weightKg: 100 }]
    });
    await repository.recordWorkoutSession(owner, {
      occurredAt: new Date("2026-10-03T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["shoulders"],
      sets: [
        { exerciseId: press.id, setIndex: 1, reps: 5, weightKg: 40, rir: 1 },
        { exerciseId: squat.id, setIndex: 2, reps: 3, weightKg: 110 }
      ]
    });

    const recent = await repository.listRecentWorkoutSessions(owner, 10);
    expect(recent.map((session) => session.occurredAt.toISOString().slice(0, 10))).toEqual(["2026-10-03", "2026-10-01"]);
    expect(recent[0].exercises.map((exercise) => exercise.name)).toEqual(["Strict Press", "Front Squat"]);
    expect(recent[0].exercises[0].sets[0]).toMatchObject({ rir: 1, setType: "working" });
    expect(recent[0].summary).toEqual({ setCount: 2, exerciseCount: 2, tonnageKg: 530 });
    expect(await repository.listRecentWorkoutSessions(owner, 1)).toHaveLength(1);
    expect(await repository.listRecentWorkoutSessions("nobody")).toEqual([]);
  });

  it("reuses an archived exercise on re-submit instead of forking its history", async () => {
    const owner = "archive-owner";
    const first = await repository.upsertExercise(owner, { name: "Pendlay Row" });
    await repository.upsertExercise(owner, { id: first.id, name: "Pendlay Row", isArchived: true });
    const again = await repository.upsertExercise(owner, { name: "pendlay row" });
    expect(again.id).toBe(first.id);
    expect(again.isArchived).toBe(false);
  });

  it("derives primaryMuscles from legacy muscleGroups when the canonical field is absent", async () => {
    const legacy = await repository.upsertExercise(userId, { name: "Legacy Curl", muscleGroups: ["biceps"] });
    expect(legacy.primaryMuscles).toEqual(["biceps"]);
    const explicit = await repository.upsertExercise(userId, {
      name: "Explicit Curl", muscleGroups: ["biceps"], primaryMuscles: ["biceps", "forearms"]
    });
    expect(explicit.primaryMuscles).toEqual(["biceps", "forearms"]);
  });

  it("rejects sessions with an invalid timezone", async () => {
    const exercise = await repository.upsertExercise(userId, { name: "Tz Check Lift" });
    await expect(repository.recordWorkoutSession(userId, {
      occurredAt: new Date("2026-09-28T09:00:00.000Z"), timezone: "Mars/Olympus", muscleGroups: ["legs"],
      sets: [{ exerciseId: exercise.id, setIndex: 1, reps: 5, weightKg: 50 }]
    })).rejects.toThrow();
  });

  it("counts weekly hard sets per muscle: primary 1, secondary 0.5, no warm-ups, Monday weeks", async () => {
    const owner = "volume-owner";
    const bench = await repository.upsertExercise(owner, {
      name: "Volume Bench", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"]
    });
    const legacy = await repository.upsertExercise(owner, { name: "Volume Legacy", muscleGroups: ["calves"] });
    const unknown = await repository.upsertExercise(owner, { name: "Volume Mystery" });
    // Wed 2026-09-30 (week of Mon 09-28) and Tue 2026-10-06 (week of Mon 10-05); "now" is Wed 10-07.
    await repository.recordWorkoutSession(owner, {
      occurredAt: new Date("2026-09-30T10:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["chest"],
      sets: [
        { exerciseId: bench.id, setIndex: 1, reps: 10, weightKg: 40, setType: "warmup" },
        { exerciseId: bench.id, setIndex: 2, reps: 8, weightKg: 80 },
        { exerciseId: bench.id, setIndex: 3, reps: 8, weightKg: 80 }
      ]
    });
    await repository.recordWorkoutSession(owner, {
      occurredAt: new Date("2026-10-06T10:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["calves"],
      sets: [
        { exerciseId: legacy.id, setIndex: 1, reps: 15, weightKg: 60 },
        { exerciseId: unknown.id, setIndex: 2, reps: 10, weightKg: 20 }
      ]
    });

    const weeks = await repository.getMuscleVolume(owner, 3, "Europe/Prague", new Date("2026-10-07T09:00:00.000Z"));
    expect(weeks.map((week) => week.weekStart)).toEqual(["2026-10-05", "2026-09-28", "2026-09-21"]);
    expect(weeks[0].sets).toEqual({ calves: 1, other: 1 });
    expect(weeks[1].sets).toEqual({ chest: 2, triceps: 1, shoulders: 1 });
    expect(weeks[1].totalSets).toBe(4);
    expect(weeks[2].sets).toEqual({});
    expect((await repository.getMuscleVolume("nobody", 1))[0].sets).toEqual({});
  });

  it("stores end-of-session feedback (exertion 1-5, mood, free text) and returns it everywhere", async () => {
    const owner = "feedback-owner";
    const lift = await repository.upsertExercise(owner, { name: "Feedback Press" });
    const input = {
      occurredAt: new Date("2026-10-04T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["chest"],
      note: "Плечо немного тянуло, последний подход тяжело",
      exertion: 4, mood: "good" as const,
      sets: [{ exerciseId: lift.id, setIndex: 1, reps: 8, weightKg: 60 }],
      idempotencyKey: "feedback-1"
    };
    const first = await repository.recordWorkoutSession(owner, input);
    expect(first).toMatchObject({ note: input.note, exertion: 4, mood: "good" });

    // retry returns the stored feedback even if the retry body differs
    const retry = await repository.recordWorkoutSession(owner, { ...input, exertion: 1, mood: "bad" as const });
    expect(retry).toMatchObject({ eventId: first.eventId, exertion: 4, mood: "good" });

    expect(await repository.getWorkoutSession(owner, first.eventId)).toMatchObject({ exertion: 4, mood: "good", note: input.note });
    expect((await repository.listRecentWorkoutSessions(owner))[0]).toMatchObject({ exertion: 4, mood: "good", note: input.note });

    const replaced = await repository.replaceWorkoutSession(owner, first.eventId, { ...input, exertion: 2, mood: "ok" as const });
    expect(replaced).toMatchObject({ exertion: 2, mood: "ok" });
  });

  it("rejects out-of-range exertion and unknown moods", async () => {
    const lift = await repository.upsertExercise(userId, { name: "Feedback Validation Lift" });
    const base = {
      occurredAt: new Date("2026-10-04T09:00:00.000Z"), timezone: "Europe/Prague", muscleGroups: ["chest"],
      sets: [{ exerciseId: lift.id, setIndex: 1, reps: 5, weightKg: 50 }]
    };
    await expect(repository.recordWorkoutSession(userId, { ...base, exertion: 6 })).rejects.toThrow();
    await expect(repository.recordWorkoutSession(userId, { ...base, exertion: 0 })).rejects.toThrow();
    await expect(repository.recordWorkoutSession(userId, { ...base, mood: "great" as never })).rejects.toThrow();
  });

  it("stores technique steps in order, returns them from search and caps them at 20", async () => {
    const owner = "instructions-owner";
    const saved = await repository.upsertExercise(owner, { name: "Steps Lift", instructions: ["Brace the core.", "Lower slowly."] });
    expect(saved.instructions).toEqual(["Brace the core.", "Lower slowly."]);
    expect((await repository.searchExercises(owner, "steps lift")).items[0].instructions).toHaveLength(2);
    await expect(repository.upsertExercise(owner, { name: "Too many steps", instructions: Array.from({ length: 21 }, () => "step") })).rejects.toThrow();
  });

  it("stores exercise images (https only, max 4) and returns them from search", async () => {
    const owner = "images-owner";
    const saved = await repository.upsertExercise(owner, {
      name: "Image Lift", images: ["https://cdn.example.test/a/0.jpg", "https://cdn.example.test/a/1.jpg"]
    });
    expect(saved.images).toEqual(["https://cdn.example.test/a/0.jpg", "https://cdn.example.test/a/1.jpg"]);
    expect((await repository.searchExercises(owner, "image lift")).items[0].images).toHaveLength(2);

    await expect(repository.upsertExercise(owner, { name: "Plain http", images: ["http://insecure.test/a.jpg"] })).rejects.toThrow();
    await expect(repository.upsertExercise(owner, {
      name: "Too many", images: Array.from({ length: 5 }, (_, index) => `https://cdn.example.test/${index}.jpg`)
    })).rejects.toThrow();
  });

  it("archives exercises out of search by default", async () => {
    const exercise = await repository.upsertExercise(userId, { name: "Zercher Squat" });
    await repository.upsertExercise(userId, { id: exercise.id, name: "Zercher Squat", isArchived: true });
    expect((await repository.searchExercises(userId, "zercher")).items).toHaveLength(0);
    expect((await repository.searchExercises(userId, "zercher", 1, 30, true)).items).toHaveLength(1);
  });

  it("returns an empty session list for a day with no workout", async () => {
    expect(await repository.getWorkoutsForDate(userId, "2026-01-01", "Europe/Prague")).toEqual([]);
  });
});
