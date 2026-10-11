import { primaryMusclesOf } from "@/domain/muscle-sets";
import { studioSpecs } from "@/lib/agent/studio-specs";
import { ToolError, toWebMcpTool, type WebMcpTool } from "@/lib/webmcp/model-context";
import type { StudioCopy } from "@/i18n/studio-messages";
import type { ExerciseSummary } from "@/lib/studio/types";
import { muscleSets, type BuilderItem, type BuilderState } from "../builder/builder-state";
import type { BuilderStore } from "../builder/builder-store";
import { agentStore } from "./agent-store";

export interface BuilderToolDeps {
  store: BuilderStore;
  copy: StudioCopy;
  /** Saves the draft; resolves with the stored template id, or rejects with a ToolError. */
  save: () => Promise<{ id: string }>;
  fetchExercise: (id: string) => Promise<ExerciseSummary>;
  createExercise: (input: { name: string; primaryMuscle: string; equipment?: string }) => Promise<ExerciseSummary>;
  /** Whether the user already allowed agent saves without asking. */
  allowSave: () => boolean;
}

const newKey = () => crypto.randomUUID();

const itemView = (item: BuilderItem, index: number) => ({
  key: item.key,
  index,
  exerciseId: item.exercise.id,
  name: item.exercise.name,
  primaryMuscles: primaryMusclesOf(item.exercise),
  sets: item.sets,
  weightKg: item.weightKg ?? null,
  repMin: item.repMin ?? null,
  repMax: item.repMax ?? null,
  targetRir: item.targetRir ?? null,
  progressionKg: item.progressionKg ?? null,
  supersetGroup: item.groupId ?? null,
  note: item.note ?? null
});

/** What the agent gets back after every call: the draft as the human sees it, including the consequences. */
export function draftView(state: BuilderState) {
  const { present } = state;
  return {
    name: present.name,
    unsavedChanges: state.dirty,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    totalSets: present.items.reduce((sum, item) => sum + item.sets, 0),
    setsPerMuscle: muscleSets(present.items),
    items: present.items.map(itemView)
  };
}

function requireItem(state: BuilderState, key: string) {
  const index = state.present.items.findIndex((item) => item.key === key);
  if (index < 0) throw new ToolError("item_not_found", `No item with key ${key}; read builder_get_draft for the current keys.`);
  return { index, item: state.present.items[index] };
}

/** WebMCP tools that drive the live template builder. Every change goes through the same store the UI uses. */
export function builderTools(deps: BuilderToolDeps): WebMcpTool[] {
  const { store, copy } = deps;
  const view = () => draftView(store.getState());
  const done = (tool: string, detail?: string, touched?: string) => {
    agentStore.record(tool, detail, touched);
    return { ok: true, draft: view() };
  };

  return [
    toWebMcpTool(studioSpecs.builder_get_draft, async () => view()),
    toWebMcpTool(studioSpecs.builder_set_name, async ({ name }) => {
      store.dispatch({ type: "rename", name: String(name) });
      return done("builder_set_name", String(name));
    }),
    toWebMcpTool(studioSpecs.builder_add_exercise, async ({ exerciseId, index }) => {
      const exercise = await deps.fetchExercise(String(exerciseId));
      const key = newKey();
      store.dispatch({ type: "add", exercise, key, index: typeof index === "number" ? index : undefined });
      return done("builder_add_exercise", exercise.name, key);
    }),
    toWebMcpTool(studioSpecs.builder_create_exercise, async ({ name, primaryMuscle, equipment }) => {
      const exercise = await deps.createExercise({ name: String(name), primaryMuscle: String(primaryMuscle), equipment: typeof equipment === "string" ? equipment : undefined });
      const key = newKey();
      store.dispatch({ type: "add", exercise, key });
      return done("builder_create_exercise", exercise.name, key);
    }),
    toWebMcpTool(studioSpecs.builder_remove_exercise, async ({ itemKey }) => {
      const { item } = requireItem(store.getState(), String(itemKey));
      store.dispatch({ type: "remove", key: item.key });
      return done("builder_remove_exercise", item.exercise.name);
    }),
    toWebMcpTool(studioSpecs.builder_move_exercise, async ({ itemKey, toIndex }) => {
      const { item } = requireItem(store.getState(), String(itemKey));
      const keys = store.getState().present.items.map((entry) => entry.key).filter((key) => key !== item.key);
      keys.splice(Math.min(Number(toIndex), keys.length), 0, item.key);
      store.dispatch({ type: "reorder", keys });
      return done("builder_move_exercise", item.exercise.name, item.key);
    }),
    toWebMcpTool(studioSpecs.builder_update_exercise, async (input) => {
      const { item } = requireItem(store.getState(), String(input.itemKey));
      const patch: Partial<Omit<BuilderItem, "key" | "exercise">> = {};
      if (input.sets !== undefined) patch.sets = Number(input.sets);
      // null clears an optional field; undefined leaves it alone.
      const optional = (value: unknown) => (value === null ? undefined : Number(value));
      if (input.weightKg !== undefined) patch.weightKg = optional(input.weightKg);
      if (input.repMin !== undefined) patch.repMin = optional(input.repMin);
      if (input.repMax !== undefined) patch.repMax = optional(input.repMax);
      if (input.targetRir !== undefined) patch.targetRir = optional(input.targetRir);
      if (input.progressionKg !== undefined) patch.progressionKg = input.progressionKg === null || input.progressionKg === 0 ? undefined : Number(input.progressionKg);
      if (input.note !== undefined) patch.note = input.note === null ? undefined : String(input.note);
      const repMin = "repMin" in patch ? patch.repMin : item.repMin;
      const repMax = "repMax" in patch ? patch.repMax : item.repMax;
      if (repMin !== undefined && repMax !== undefined && repMin > repMax) throw new ToolError("invalid_input", "repMin must not exceed repMax.");
      store.dispatch({ type: "patch", key: item.key, patch });
      return done("builder_update_exercise", item.exercise.name, item.key);
    }),
    toWebMcpTool(studioSpecs.builder_link_superset, async ({ itemKey, linked }) => {
      const { index, item } = requireItem(store.getState(), String(itemKey));
      const next = store.getState().present.items[index + 1];
      if (!next) throw new ToolError("no_next_item", "The last item has nothing to link with.");
      const isLinked = item.groupId !== undefined && item.groupId === next.groupId;
      if (isLinked !== Boolean(linked)) store.dispatch({ type: "toggleSuperset", key: item.key, groupId: newKey().slice(0, 8) });
      return done("builder_link_superset", `${item.exercise.name} + ${next.exercise.name}`, item.key);
    }),
    toWebMcpTool(studioSpecs.builder_undo, async () => {
      store.dispatch({ type: "undo" });
      return done("builder_undo");
    }),
    toWebMcpTool(studioSpecs.builder_redo, async () => {
      store.dispatch({ type: "redo" });
      return done("builder_redo");
    }),
    toWebMcpTool(studioSpecs.builder_save, async () => {
      const { present } = store.getState();
      if (!present.name.trim()) throw new ToolError("name_required", copy.builder.nameRequired);
      if (!present.items.length) throw new ToolError("exercises_required", copy.builder.exercisesRequired);
      if (!deps.allowSave() && !(await agentStore.requestConfirm(copy.agent.saveConfirm.replace("{name}", present.name), { rememberable: true }))) {
        throw new ToolError("user_declined", "The user declined to save.");
      }
      const saved = await deps.save();
      agentStore.record("builder_save", present.name);
      return { ok: true, templateId: saved.id, draft: view() };
    }, { consequential: true })
  ];
}
