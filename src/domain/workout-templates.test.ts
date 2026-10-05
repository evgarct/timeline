import { describe, expect, it } from "vitest";
import { suggestNextLoad, templateExerciseSchema, workoutTemplateInputSchema } from "./workout-templates";

const exerciseId = "6f1c1c4e-3b6e-4b6b-8f0e-2a4f5f9d7a11";
const double = { type: "double" as const, incrementKg: 2.5 };

describe("suggestNextLoad (double progression)", () => {
  it("suggests nothing without history", () => {
    expect(suggestNextLoad({ repMax: 10, progression: double }, [])).toEqual({ reason: "no_history" });
  });

  it("adds the increment once every top-weight set reaches the top of the range", () => {
    const sets = [{ weightKg: 80, reps: 10 }, { weightKg: 80, reps: 10 }, { weightKg: 80, reps: 10 }];
    expect(suggestNextLoad({ repMax: 10, progression: double }, sets)).toEqual({ weightKg: 82.5, reason: "increase" });
  });

  it("holds the weight when any top set misses the range", () => {
    const sets = [{ weightKg: 80, reps: 10 }, { weightKg: 80, reps: 8 }];
    expect(suggestNextLoad({ repMax: 10, progression: double }, sets)).toEqual({ weightKg: 80, reason: "hold" });
  });

  it("judges only the heaviest sets, so lighter back-off sets do not block progress", () => {
    const sets = [{ weightKg: 80, reps: 10 }, { weightKg: 60, reps: 6 }];
    expect(suggestNextLoad({ repMax: 10, progression: double }, sets).reason).toBe("increase");
  });

  it("holds when no rule or no repMax is defined, and never suggests a drop", () => {
    const sets = [{ weightKg: 80, reps: 12 }];
    expect(suggestNextLoad({ repMax: 10 }, sets)).toEqual({ weightKg: 80, reason: "hold" });
    expect(suggestNextLoad({ progression: double }, sets)).toEqual({ weightKg: 80, reason: "hold" });
  });
});

describe("template schemas", () => {
  it("applies defaults and rejects an inverted rep range", () => {
    expect(templateExerciseSchema.parse({ exerciseId }).sets).toBe(3);
    expect(templateExerciseSchema.safeParse({ exerciseId, repMin: 12, repMax: 6 }).success).toBe(false);
  });

  it("requires at least one exercise and a name", () => {
    expect(workoutTemplateInputSchema.safeParse({ name: "Push A", exercises: [] }).success).toBe(false);
    expect(workoutTemplateInputSchema.safeParse({ name: " ", exercises: [{ exerciseId }] }).success).toBe(false);
    expect(workoutTemplateInputSchema.parse({ name: "Push A", exercises: [{ exerciseId, repMin: 6, repMax: 10, targetRir: 2 }] }).isArchived).toBe(false);
  });
});
