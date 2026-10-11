"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * A stable getter for the latest value. WebMCP tool handlers outlive renders, so they call this instead of
 * closing over render state, which would be stale by the time an agent calls them.
 */
export function useLatest<T>(value: T): () => T {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return useCallback(() => ref.current, []);
}
