import type { WorkoutTemplateInput } from "@/domain/workout-templates";
import type { ExerciseSummary, StoredTemplate } from "@/lib/studio/types";

/** One row on the canvas. `key` is local identity (an exercise may appear twice in a template). */
export interface BuilderItem {
  key: string;
  exercise: ExerciseSummary;
  sets: number;
  weightKg?: number;
  repMin?: number;
  repMax?: number;
  targetRir?: number;
  groupId?: string;
  groupLabel?: string;
  /** Double-progression increment; undefined = no rule. */
  progressionKg?: number;
  note?: string;
}

export interface BuilderDoc {
  name: string;
  note?: string;
  items: BuilderItem[];
}

export interface BuilderState {
  past: BuilderDoc[];
  present: BuilderDoc;
  future: BuilderDoc[];
  dirty: boolean;
}

export type BuilderAction =
  | { type: "load"; doc: BuilderDoc }
  | { type: "rename"; name: string }
  | { type: "add"; exercise: ExerciseSummary; key: string }
  | { type: "remove"; key: string }
  | { type: "reorder"; keys: string[] }
  | { type: "patch"; key: string; patch: Partial<Omit<BuilderItem, "key" | "exercise">> }
  | { type: "toggleSuperset"; key: string; groupId: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved" };

const HISTORY_LIMIT = 100;

export const emptyDoc: BuilderDoc = { name: "", items: [] };

export function initialState(doc: BuilderDoc = emptyDoc): BuilderState {
  return { past: [], present: doc, future: [], dirty: false };
}

/** A superset is a run of neighbours sharing a groupId. Drop ids that are no longer contiguous or have one member. */
export function normalizeGroups(items: BuilderItem[]): BuilderItem[] {
  return items.map((item, index) => {
    if (!item.groupId) return item;
    const prev = items[index - 1]?.groupId === item.groupId;
    const next = items[index + 1]?.groupId === item.groupId;
    if (prev || next) return item;
    return { ...item, groupId: undefined, groupLabel: undefined };
  });
}

function commit(state: BuilderState, next: BuilderDoc): BuilderState {
  const present = { ...next, items: normalizeGroups(next.items) };
  return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [], dirty: true };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const doc = state.present;
  switch (action.type) {
    case "load":
      return initialState(action.doc);
    case "saved":
      return { ...state, dirty: false };
    case "rename":
      return action.name === doc.name ? state : commit(state, { ...doc, name: action.name });
    case "add": {
      const item: BuilderItem = { key: action.key, exercise: action.exercise, sets: 3 };
      return commit(state, { ...doc, items: [...doc.items, item] });
    }
    case "remove":
      return commit(state, { ...doc, items: doc.items.filter((item) => item.key !== action.key) });
    case "reorder": {
      const byKey = new Map(doc.items.map((item) => [item.key, item]));
      const items = action.keys.flatMap((key) => byKey.get(key) ?? []);
      if (items.length !== doc.items.length || items.every((item, index) => item === doc.items[index])) return state;
      return commit(state, { ...doc, items });
    }
    case "patch":
      return commit(state, { ...doc, items: doc.items.map((item) => (item.key === action.key ? { ...item, ...action.patch } : item)) });
    case "toggleSuperset": {
      const index = doc.items.findIndex((item) => item.key === action.key);
      const current = doc.items[index];
      const next = doc.items[index + 1];
      if (!current || !next) return state;
      const linked = current.groupId !== undefined && current.groupId === next.groupId;
      // Unlinking one boundary splits the run: everything after it moves to a fresh group, so A-B-C
      // split at A|B keeps B-C together (single leftovers are dropped by normalizeGroups).
      let tail = linked;
      const items = doc.items.map((item, position) => {
        if (linked) {
          if (position <= index) return item;
          if (tail && item.groupId === current.groupId) return { ...item, groupId: action.groupId };
          tail = false;
          return item;
        }
        if (item === current) return { ...item, groupId: current.groupId ?? action.groupId };
        if (item === next) return { ...item, groupId: current.groupId ?? action.groupId, groupLabel: current.groupLabel };
        return item;
      });
      return commit(state, { ...doc, items });
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], dirty: true };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { past: [...state.past, state.present], present: next, future: rest, dirty: true };
    }
  }
}

/** Sets per muscle, as the API counts them: primary 1, secondary 0.5. */
export function muscleSets(items: BuilderItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const primary = item.exercise.primaryMuscles?.length ? item.exercise.primaryMuscles : item.exercise.muscleGroups ?? [];
    for (const muscle of primary) totals[muscle] = (totals[muscle] ?? 0) + item.sets;
    for (const muscle of item.exercise.secondaryMuscles ?? []) {
      if (!primary.includes(muscle)) totals[muscle] = (totals[muscle] ?? 0) + item.sets * 0.5;
    }
  }
  return totals;
}

export function toTemplateInput(doc: BuilderDoc, id?: string): WorkoutTemplateInput {
  return {
    id,
    name: doc.name.trim(),
    note: doc.note || undefined,
    isArchived: false,
    exercises: doc.items.map((item) => {
      const repMin = item.repMin;
      const repMax = item.repMax;
      return {
        exerciseId: item.exercise.id,
        sets: item.sets,
        weightKg: item.weightKg,
        // A reversed range would be rejected by the API; keep what the user typed meaningful instead.
        repMin: repMin !== undefined && repMax !== undefined ? Math.min(repMin, repMax) : repMin,
        repMax: repMin !== undefined && repMax !== undefined ? Math.max(repMin, repMax) : repMax,
        targetRir: item.targetRir,
        groupId: item.groupId,
        groupLabel: item.groupLabel,
        progression: item.progressionKg ? { type: "double" as const, incrementKg: item.progressionKg } : undefined,
        note: item.note || undefined
      };
    })
  };
}

export function docFromTemplate(template: StoredTemplate, catalog: Map<string, ExerciseSummary>): BuilderDoc {
  return {
    name: template.name,
    note: template.note,
    items: template.exercises.map((entry, index) => ({
      key: `${entry.exerciseId}:${index}`,
      exercise: catalog.get(entry.exerciseId) ?? { id: entry.exerciseId, name: "…" },
      sets: entry.sets,
      weightKg: entry.weightKg,
      repMin: entry.repMin,
      repMax: entry.repMax,
      targetRir: entry.targetRir,
      groupId: entry.groupId,
      groupLabel: entry.groupLabel,
      progressionKg: entry.progression?.incrementKg,
      note: entry.note
    }))
  };
}
