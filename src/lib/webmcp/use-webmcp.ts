"use client";

import { useEffect } from "react";
import { registerTools, type WebMcpTool } from "./model-context";

/**
 * Registers a page's WebMCP tools while it is mounted and withdraws them on unmount, so an agent only ever sees
 * tools that match what is on screen. `tools` must be memoized: a new array re-registers everything.
 */
export function useWebMcpTools(tools: WebMcpTool[] | null) {
  useEffect(() => {
    if (!tools) return;
    return registerTools(tools);
  }, [tools]);
}
