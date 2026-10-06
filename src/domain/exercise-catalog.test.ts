import { describe, expect, it } from "vitest";
import { canonicalMuscle, inferMovementPattern, mapDatasetExercise, mapFreeExercise } from "./exercise-catalog";

describe("exercise catalog mapping", () => {
  it("maps dataset muscle names onto the canonical vocabulary and drops non-muscles", () => {
    expect(canonicalMuscle("pectorals")).toBe("chest");
    expect(canonicalMuscle("Delts")).toBe("shoulders");
    expect(canonicalMuscle("spine")).toBe("lower back");
    expect(canonicalMuscle("cardiovascular system")).toBeNull();
    expect(canonicalMuscle("unknown thing")).toBeNull();
  });

  it("maps a dataset row without copying media and keeps the source id", () => {
    const mapped = mapDatasetExercise({
      id: "0025", name: "barbell bench press", target: "pectorals",
      secondary_muscles: ["triceps", "shoulders", "chest", "triceps"], equipment: "Barbell"
    });
    expect(mapped).toEqual({
      name: "Barbell Bench Press",
      searchAliases: [],
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps", "shoulders"],
      movementPattern: "push",
      equipment: "barbell",
      externalRef: { source: "exercises-dataset", id: "0025" }
    });
  });

  it("maps free-exercise-db rows: canonical muscles, equipment and commit-pinned photo URLs", () => {
    const sha = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
    const mapped = mapFreeExercise({
      id: "Barbell_Bent_Over_Row", name: "bent over barbell row", force: "pull", equipment: "body only",
      primaryMuscles: ["middle back", "lats"], secondaryMuscles: ["biceps", "abdominals", "lats"],
      images: ["Barbell_Bent_Over_Row/0.jpg", "Barbell_Bent_Over_Row/1.jpg"]
    }, sha);

    expect(mapped).toMatchObject({
      name: "Bent Over Barbell Row",
      primaryMuscles: ["upper back", "lats"],
      secondaryMuscles: ["biceps", "abs"],
      movementPattern: "pull",
      equipment: "body weight",
      externalRef: { source: "free-exercise-db", id: "Barbell_Bent_Over_Row" }
    });
    expect(mapped?.images).toEqual([
      `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${sha}/exercises/Barbell_Bent_Over_Row/0.jpg`,
      `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${sha}/exercises/Barbell_Bent_Over_Row/1.jpg`
    ]);
    expect(mapFreeExercise({ id: "x", name: "Plank", primaryMuscles: ["abdominals"], secondaryMuscles: [], equipment: null }, sha)?.images).toEqual([]);
    expect(mapFreeExercise({ id: "y", name: "Kettlebell Swing", primaryMuscles: ["glutes"], secondaryMuscles: [], equipment: "kettlebells" }, sha)?.equipment).toBe("kettlebell");
  });

  it("infers movement patterns from the name, then from the target muscle", () => {
    expect(inferMovementPattern("romanian deadlift", ["hamstrings"])).toBe("hinge");
    expect(inferMovementPattern("walking lunge", ["quads"])).toBe("lunge");
    expect(inferMovementPattern("barbell back squat", ["quads"])).toBe("squat");
    expect(inferMovementPattern("seated cable row", ["upper back"])).toBe("pull");
    expect(inferMovementPattern("leg curl", ["hamstrings"])).toBe("hinge");
    expect(inferMovementPattern("crunch", ["abs"])).toBe("core");
    expect(inferMovementPattern("treadmill run", [])).toBe("other");
  });
});
