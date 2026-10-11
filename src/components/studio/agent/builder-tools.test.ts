import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioCopy } from "@/i18n/studio-messages";
import { registerTools, type WebMcpTool } from "@/lib/webmcp/model-context";
import type { ExerciseSummary } from "@/lib/studio/types";
import { createBuilderStore, type BuilderStore } from "../builder/builder-store";
import { agentStore } from "./agent-store";
import { builderTools, type BuilderToolDeps } from "./builder-tools";

const copy = getStudioCopy("en");
const exercises: Record<string, ExerciseSummary> = {
  "00000000-0000-4000-8000-000000000001": { id: "00000000-0000-4000-8000-000000000001", name: "Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"] },
  "00000000-0000-4000-8000-000000000002": { id: "00000000-0000-4000-8000-000000000002", name: "Overhead Press", primaryMuscles: ["shoulders"] },
  "00000000-0000-4000-8000-000000000003": { id: "00000000-0000-4000-8000-000000000003", name: "Cable Fly", primaryMuscles: ["chest"] }
};
const ids = Object.keys(exercises);

type Call = (name: string, input?: Record<string, unknown>) => Promise<Record<string, unknown>>;

function setup(overrides: Partial<BuilderToolDeps> = {}) {
  const store: BuilderStore = createBuilderStore({ name: "", items: [] });
  const save = vi.fn(async () => ({ id: "saved-id" }));
  const registered = new Map<string, WebMcpTool["execute"]>();
  const context = { registerTool: (tool: { name: string; execute: WebMcpTool["execute"] }) => { registered.set(tool.name, tool.execute); } };
  registerTools(builderTools({
    store, copy, save, allowSave: () => false,
    fetchExercise: async (id) => exercises[id],
    createExercise: async (input) => ({ id: "00000000-0000-4000-8000-0000000000aa", name: input.name, primaryMuscles: [input.primaryMuscle] }),
    ...overrides
  }), context);
  const call: Call = async (name, input = {}) => (await registered.get(name)!(input)) as Record<string, unknown>;
  return { store, save, call };
}

beforeEach(() => { agentStore.answerConfirm(false); });

describe("builder WebMCP tools", () => {
  it("builds a template through the same store the UI uses, returning the draft after each call", async () => {
    const { store, call } = setup();
    await call("builder_set_name", { name: "Push day" });
    await call("builder_add_exercise", { exerciseId: ids[0] });
    const second = await call("builder_add_exercise", { exerciseId: ids[1] });
    const draft = second.draft as { items: Array<{ key: string; name: string }>; totalSets: number; setsPerMuscle: Record<string, number> };
    expect(draft.items.map((item) => item.name)).toEqual(["Bench Press", "Overhead Press"]);
    expect(draft.totalSets).toBe(6);
    expect(draft.setsPerMuscle).toEqual({ chest: 3, triceps: 1.5, shoulders: 3 });
    expect(store.getState().present.name).toBe("Push day");
    expect(store.getState().dirty).toBe(true);
  });

  it("updates a prescription, clears fields with null and rejects reversed rep ranges", async () => {
    const { call } = setup();
    const added = await call("builder_add_exercise", { exerciseId: ids[0] });
    const key = (added.draft as { items: Array<{ key: string }> }).items[0].key;
    const updated = await call("builder_update_exercise", { itemKey: key, sets: 4, weightKg: 80, repMin: 6, repMax: 8, targetRir: 2, progressionKg: 2.5 });
    expect((updated.draft as { items: Array<Record<string, unknown>> }).items[0]).toMatchObject({ sets: 4, weightKg: 80, repMin: 6, repMax: 8, targetRir: 2, progressionKg: 2.5 });
    const cleared = await call("builder_update_exercise", { itemKey: key, weightKg: null });
    expect((cleared.draft as { items: Array<Record<string, unknown>> }).items[0].weightKg).toBeNull();
    expect(await call("builder_update_exercise", { itemKey: key, repMin: 12 })).toMatchObject({ ok: false, error: "invalid_input" });
    expect(await call("builder_update_exercise", { itemKey: "nope", sets: 3 })).toMatchObject({ ok: false, error: "item_not_found" });
  });

  it("moves items, links and unlinks a superset and supports undo", async () => {
    const { store, call } = setup();
    for (const id of ids) await call("builder_add_exercise", { exerciseId: id });
    const keys = store.getState().present.items.map((item) => item.key);

    await call("builder_move_exercise", { itemKey: keys[2], toIndex: 0 });
    expect(store.getState().present.items.map((item) => item.exercise.name)).toEqual(["Cable Fly", "Bench Press", "Overhead Press"]);

    const linked = await call("builder_link_superset", { itemKey: keys[2], linked: true });
    const groups = (linked.draft as { items: Array<{ supersetGroup: string | null }> }).items.map((item) => item.supersetGroup);
    expect(groups[0]).not.toBeNull();
    expect(groups[0]).toBe(groups[1]);
    expect(await call("builder_link_superset", { itemKey: keys[1], linked: false })).toMatchObject({ ok: false, error: "no_next_item" });

    const unlinked = await call("builder_link_superset", { itemKey: keys[2], linked: false });
    expect((unlinked.draft as { items: Array<{ supersetGroup: string | null }> }).items.every((item) => item.supersetGroup === null)).toBe(true);

    await call("builder_undo");
    expect(store.getState().present.items[0].groupId).toBeDefined();
    await call("builder_redo");
    expect(store.getState().present.items[0].groupId).toBeUndefined();
  });

  it("creates an exercise and removes an item", async () => {
    const { store, call } = setup();
    await call("builder_create_exercise", { name: "Zottman Curl", primaryMuscle: "biceps" });
    const key = store.getState().present.items[0].key;
    expect(store.getState().present.items[0].exercise.name).toBe("Zottman Curl");
    await call("builder_remove_exercise", { itemKey: key });
    expect(store.getState().present.items).toHaveLength(0);
  });

  it("asks the human before saving unless they allowed it, and never saves an empty draft", async () => {
    const { store, save, call } = setup();
    expect(await call("builder_save")).toMatchObject({ ok: false, error: "name_required" });
    await call("builder_set_name", { name: "Push day" });
    expect(await call("builder_save")).toMatchObject({ ok: false, error: "exercises_required" });
    await call("builder_add_exercise", { exerciseId: ids[0] });

    const declined = call("builder_save");
    await vi.waitFor(() => expect(agentStore.getState().confirm?.message).toContain("Push day"));
    agentStore.answerConfirm(false);
    expect(await declined).toMatchObject({ ok: false, error: "user_declined" });
    expect(save).not.toHaveBeenCalled();

    const approved = call("builder_save");
    await vi.waitFor(() => expect(agentStore.getState().confirm).not.toBeNull());
    agentStore.answerConfirm(true);
    expect(await approved).toMatchObject({ ok: true, templateId: "saved-id" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getState().present.name).toBe("Push day");
  });

  it("saves without asking once the user allowed it, and logs what the agent did", async () => {
    const { save, call } = setup({ allowSave: () => true });
    await call("builder_set_name", { name: "Pull day" });
    await call("builder_add_exercise", { exerciseId: ids[1] });
    expect(await call("builder_save")).toMatchObject({ ok: true });
    expect(save).toHaveBeenCalled();
    expect(agentStore.getState().actions.slice(0, 3).map((action) => action.tool)).toEqual(["builder_save", "builder_add_exercise", "builder_set_name"]);
  });
});
