import { describe, expect, it } from "vitest";
import { muscleSetTotals, rollupMuscle } from "./muscle-sets";

describe("muscle roll-up", () => {
  it("counts abductors as glutes without double counting", () => {
    expect(rollupMuscle("abductors")).toBe("glutes");
    expect(muscleSetTotals([
      { sets: 3, exercise: { primaryMuscles: ["abductors"], secondaryMuscles: ["glutes"] } }
    ])).toEqual({ glutes: 3 });
  });
});
