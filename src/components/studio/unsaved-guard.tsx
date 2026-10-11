"use client";

import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from "react";

interface Guard {
  setDirty: (dirty: boolean) => void;
  /** Call from a link's onClick: cancels the navigation unless the user confirms leaving. */
  confirmLeave: (event: MouseEvent, message: string) => void;
}

const GuardContext = createContext<Guard | null>(null);

/**
 * `beforeunload` does not fire for Next.js client-side transitions, so in-app links ask explicitly
 * while an editor reports unsaved changes.
 */
export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  // The flag lives in a closure created once, so nothing reads a ref during render.
  const [guard] = useState<Guard>(() => {
    let dirty = false;
    return {
      setDirty: (value) => { dirty = value; },
      confirmLeave: (event, message) => {
        if (dirty && !window.confirm(message)) event.preventDefault();
      }
    };
  });
  return <GuardContext.Provider value={guard}>{children}</GuardContext.Provider>;
}

export function useUnsavedGuard() {
  return useContext(GuardContext);
}

/** Registers the editor's dirty flag with the surrounding guard for as long as it is mounted. */
export function useReportDirty(dirty: boolean) {
  const guard = useUnsavedGuard();
  useEffect(() => {
    guard?.setDirty(dirty);
    return () => guard?.setDirty(false);
  }, [guard, dirty]);
}
