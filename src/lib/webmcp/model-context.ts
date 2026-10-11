import { z } from "zod";
import type { ToolSpec } from "@/lib/agent/specs";

/**
 * WebMCP (W3C Web Machine Learning CG draft): a page registers tools that a browser agent can call.
 * The entry point has moved between drafts (`navigator.modelContext` in early write-ups, `document.modelContext`
 * in the current draft), so both are probed and nothing here may throw when neither exists.
 */
export interface WebMcpAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
}

export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
}

interface ModelContextLike {
  registerTool(tool: unknown, options?: { signal?: AbortSignal }): unknown;
  unregisterTool?(name: string): void;
}

/** A refusal the agent should read and adapt to (bad input, user said no), as opposed to a crash. */
export class ToolError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

export function getModelContext(): ModelContextLike | undefined {
  const fromDocument = typeof document !== "undefined" ? (document as unknown as { modelContext?: ModelContextLike }).modelContext : undefined;
  const fromNavigator = typeof navigator !== "undefined" ? (navigator as unknown as { modelContext?: ModelContextLike }).modelContext : undefined;
  const context = fromDocument ?? fromNavigator;
  return context && typeof context.registerTool === "function" ? context : undefined;
}

export function isWebMcpAvailable() {
  return getModelContext() !== undefined;
}

/** Turns a registry spec into a WebMCP tool; the JSON Schema is generated from the spec's zod input. */
export function toWebMcpTool(spec: ToolSpec, execute: WebMcpTool["execute"], extra: { consequential?: boolean } = {}): WebMcpTool {
  const parse = (input: Record<string, unknown>) => {
    const parsed = spec.input.safeParse(input);
    if (!parsed.success) throw new ToolError("invalid_input", parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
    return parsed.data as Record<string, unknown>;
  };
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: z.toJSONSchema(spec.input, { unrepresentable: "any", io: "input" }) as Record<string, unknown>,
    annotations: {
      ...(spec.annotations.readOnlyHint ? { readOnlyHint: true } : {}),
      ...(spec.annotations.destructiveHint || extra.consequential ? { consequentialHint: true } : {})
    },
    execute: async (input, options) => execute(parse(input ?? {}), options)
  };
}

const MAX_RESULT_CHARS = 60_000;

/**
 * The draft says `executeTool` resolves to the JSON-serialized return value of `execute`, so a plain
 * JSON-serializable value is returned. Expected refusals become `{ ok: false, error }` the agent can act on.
 */
async function run(tool: WebMcpTool, input: Record<string, unknown>, options?: { signal?: AbortSignal }) {
  try {
    const value = await tool.execute(input ?? {}, options);
    const json = JSON.stringify(value ?? { ok: true });
    return json.length > MAX_RESULT_CHARS
      ? { ok: false, error: "result_too_large", message: `The result has ${json.length} characters; ask for less (a smaller limit or a narrower window).` }
      : (value ?? { ok: true });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, error: error.code, message: error.message };
    if (options?.signal?.aborted) throw error;
    return { ok: false, error: "tool_failed", message: error instanceof Error ? error.message : "unexpected error" };
  }
}

/**
 * Registers the tools and returns a disposer. Registration is undone by aborting the shared signal (the draft's
 * mechanism), with `unregisterTool` as a fallback for engines that still ship it. Without WebMCP this is a no-op.
 */
export function registerTools(tools: WebMcpTool[], context: ModelContextLike | undefined = getModelContext()): () => void {
  if (!context || tools.length === 0) return () => undefined;
  const controller = new AbortController();
  const registered: string[] = [];
  for (const tool of tools) {
    try {
      context.registerTool({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => run(tool, input, options)
      }, { signal: controller.signal });
      registered.push(tool.name);
    } catch (error) {
      console.warn(`WebMCP: could not register ${tool.name}`, error);
    }
  }
  return () => {
    controller.abort();
    if (typeof context.unregisterTool === "function") {
      for (const name of registered) {
        try { context.unregisterTool(name); } catch { /* already gone */ }
      }
    }
  };
}
