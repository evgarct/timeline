import { useSyncExternalStore } from "react";

export interface AgentAction {
  id: number;
  tool: string;
  detail?: string;
  at: number;
}

export interface AgentState {
  actions: AgentAction[];
  /** The draft item the agent touched last, so its card can glow. */
  touched: { key: string; at: number } | null;
  confirm: { message: string; rememberable: boolean } | null;
  allowSave: boolean;
}

const ALLOW_SAVE_KEY = "studio:agent-allow-save";
const MAX_ACTIONS = 30;

function readAllowSave() {
  try { return window.localStorage.getItem(ALLOW_SAVE_KEY) === "1"; } catch { return false; }
}

/**
 * What the browser copilot did on the page, and the questions it asks the human. It is a module-level store because
 * WebMCP tools are plain functions outside React; the Studio shell renders it as the "agent" chip and the
 * confirmation dialog, so agent actions are always visible and consequential ones need a human yes.
 */
function createAgentStore() {
  let state: AgentState = { actions: [], touched: null, confirm: null, allowSave: false };
  let nextId = 1;
  let pending: ((approved: boolean, remember: boolean) => void) | null = null;
  const listeners = new Set<() => void>();
  const set = (next: Partial<AgentState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** Reads the persisted "allow saving without asking" choice (browser only). */
    hydrate() {
      const allowSave = readAllowSave();
      if (allowSave !== state.allowSave) set({ allowSave });
    },
    record(tool: string, detail?: string, touchedKey?: string) {
      const action: AgentAction = { id: nextId++, tool, detail, at: Date.now() };
      set({ actions: [action, ...state.actions].slice(0, MAX_ACTIONS), ...(touchedKey ? { touched: { key: touchedKey, at: action.at } } : {}) });
    },
    setAllowSave(allowSave: boolean) {
      try { window.localStorage.setItem(ALLOW_SAVE_KEY, allowSave ? "1" : "0"); } catch { /* storage may be unavailable */ }
      set({ allowSave });
    },
    /** Asks the human; resolves false when they decline. A second question while one is open is declined. */
    requestConfirm(message: string, options: { rememberable?: boolean } = {}): Promise<boolean> {
      if (pending) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        pending = (approved, remember) => {
          pending = null;
          if (approved && remember && options.rememberable) this.setAllowSave(true);
          set({ confirm: null });
          resolve(approved);
        };
        set({ confirm: { message, rememberable: Boolean(options.rememberable) } });
      });
    },
    answerConfirm(approved: boolean, remember = false) {
      pending?.(approved, remember);
    }
  };
}

export const agentStore = createAgentStore();

export function useAgentState(): AgentState {
  return useSyncExternalStore(agentStore.subscribe, agentStore.getState, agentStore.getState);
}
