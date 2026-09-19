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
    expect(sessions[0].exercises[0].sets).toEqual([
      { setIndex: 1, reps: 5, weightKg: 100 },
      { setIndex: 2, reps: 5, weightKg: 102.5 }
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

  it("returns an empty session list for a day with no workout", async () => {
    expect(await repository.getWorkoutsForDate(userId, "2026-01-01", "Europe/Prague")).toEqual([]);
  });
});
