import { describe, expect, it } from "vitest";
import { canonicalMuscle, inferMovementPattern, mapDatasetExercise } from "./exercise-catalog";

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
