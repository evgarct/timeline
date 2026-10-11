import { useSyncExternalStore } from "react";
import { builderReducer, initialState, type BuilderAction, type BuilderDoc, type BuilderState } from "./builder-state";

/**
 * The builder's state lives outside React so things that are not components (the WebMCP tools an agent
 * calls, drag handlers) can read and write it. Components subscribe through `useBuilderState`.
 */
export interface BuilderStore {
  getState: () => BuilderState;
  dispatch: (action: BuilderAction) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createBuilderStore(doc?: BuilderDoc): BuilderStore {
  let state = initialState(doc);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = builderReducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}

export function useBuilderState(store: BuilderStore): BuilderState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
