import { describe, expect, it } from "vitest";
import { workoutTemplateInputSchema } from "@/domain/workout-templates";
import { builderReducer, initialState, muscleSets, normalizeGroups, toTemplateInput, type BuilderItem, type BuilderState } from "./builder-state";

const exercise = (n: number, extra: Partial<BuilderItem["exercise"]> = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, name: `Exercise ${n}`, ...extra
});

function withExercises(count: number): BuilderState {
  let state = initialState({ name: "Push", items: [] });
  for (let n = 1; n <= count; n += 1) state = builderReducer(state, { type: "add", exercise: exercise(n), key: `k${n}` });
  return state;
}

describe("builderReducer", () => {
  it("adds, patches and removes with undo/redo", () => {
    let state = withExercises(2);
    state = builderReducer(state, { type: "patch", key: "k1", patch: { sets: 5 } });
    expect(state.present.items[0].sets).toBe(5);
    state = builderReducer(state, { type: "remove", key: "k2" });
    expect(state.present.items).toHaveLength(1);
    state = builderReducer(state, { type: "undo" });
    expect(state.present.items).toHaveLength(2);
    state = builderReducer(state, { type: "redo" });
    expect(state.present.items).toHaveLength(1);
  });

  it("links neighbours into a superset and unlinks them again", () => {
    let state = withExercises(3);
    state = builderReducer(state, { type: "toggleSuperset", key: "k1", groupId: "g1" });
    expect(state.present.items.map((item) => item.groupId)).toEqual(["g1", "g1", undefined]);
    state = builderReducer(state, { type: "toggleSuperset", key: "k1", groupId: "g2" });
    expect(state.present.items.map((item) => item.groupId)).toEqual([undefined, undefined, undefined]);
  });

  it("keeps the remaining pair when one boundary of a three-exercise superset is unlinked", () => {
    let state = withExercises(3);
    state = builderReducer(state, { type: "toggleSuperset", key: "k1", groupId: "g1" });
    state = builderReducer(state, { type: "toggleSuperset", key: "k2", groupId: "g1" });
    expect(state.present.items.map((item) => item.groupId)).toEqual(["g1", "g1", "g1"]);
    state = builderReducer(state, { type: "toggleSuperset", key: "k1", groupId: "g2" });
    const [a, b, c] = state.present.items;
    expect(a.groupId).toBeUndefined();
    expect(b.groupId).toBeDefined();
    expect(b.groupId).toBe(c.groupId);
  });

  it("drops a group id when a reorder splits the superset", () => {
    let state = withExercises(3);
    state = builderReducer(state, { type: "toggleSuperset", key: "k1", groupId: "g1" });
    state = builderReducer(state, { type: "reorder", keys: ["k1", "k3", "k2"] });
    expect(state.present.items.every((item) => item.groupId === undefined)).toBe(true);
  });

  it("ignores a reorder that changes nothing", () => {
    const state = withExercises(2);
    expect(builderReducer(state, { type: "reorder", keys: ["k1", "k2"] })).toBe(state);
  });

  it("normalizeGroups clears a lone group member", () => {
    const items = withExercises(2).present.items.map((item, index) => (index === 0 ? { ...item, groupId: "g" } : item));
    expect(normalizeGroups(items)[0].groupId).toBeUndefined();
  });
});

describe("muscleSets", () => {
  it("counts primary as 1 and secondary as 0.5 per set", () => {
    const state = builderReducer(initialState(), {
      type: "add", key: "a", exercise: exercise(1, { primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "chest"] })
    });
    expect(muscleSets(state.present.items)).toEqual({ chest: 3, triceps: 1.5 });
  });
});

describe("toTemplateInput", () => {
  it("produces a payload the API schema accepts and fixes reversed rep ranges", () => {
    let state = withExercises(2);
    state = builderReducer(state, { type: "patch", key: "k1", patch: { repMin: 12, repMax: 8, progressionKg: 2.5, weightKg: 60 } });
    const input = toTemplateInput(state.present);
    const parsed = workoutTemplateInputSchema.parse(input);
    expect(parsed.exercises[0]).toMatchObject({ repMin: 8, repMax: 12, progression: { type: "double", incrementKg: 2.5 }, weightKg: 60 });
  });
});
