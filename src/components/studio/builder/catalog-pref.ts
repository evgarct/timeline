"use client";

import { useSyncExternalStore } from "react";

const KEY = "studio:catalog-open";
const listeners = new Set<() => void>();
let memory: boolean | null = null; // used when storage is blocked

function read(): boolean | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === null ? memory : value === "1";
  } catch { return memory; }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setOpen(open: boolean) {
  memory = open;
  try { window.localStorage.setItem(KEY, open ? "1" : "0"); } catch { /* storage may be unavailable */ }
  for (const listener of listeners) listener();
}

/** The person's last choice for the builder's catalog panel (null until they choose), shared across builder visits. */
export function useCatalogPreference(): [boolean | null, (open: boolean) => void] {
  const preference = useSyncExternalStore(subscribe, read, () => null);
  return [preference, setOpen];
}
