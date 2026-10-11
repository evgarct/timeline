import { allSpecs, type ToolSpec } from "@/lib/agent/specs";
import { ToolError, toWebMcpTool, type WebMcpTool } from "./model-context";

export interface BridgeDeps {
  fetchImpl?: typeof fetch;
  /** Asked before a destructive tool runs; resolving false cancels it. */
  confirm?: (message: string) => Promise<boolean>;
  /** Called after a successful write (POST/PUT/DELETE) so the UI can refresh what it shows. */
  onWrite?: (spec: ToolSpec) => void;
}

/** Builds the request a spec's REST mapping describes. Exported for tests. */
export function buildRequest(spec: ToolSpec, input: Record<string, unknown>) {
  const rest = spec.rest;
  if (!rest) throw new Error(`${spec.name} has no REST mapping`);
  const pathFields = new Set<string>();
  const path = rest.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    pathFields.add(name);
    return encodeURIComponent(String(input[name]));
  });
  const query = new URLSearchParams();
  for (const name of rest.query ?? []) {
    const value = input[name];
    if (value !== undefined && value !== null) query.set(name, String(value));
  }
  const queryFields = new Set(rest.query ?? []);
  let body: unknown;
  if (rest.method === "POST" || rest.method === "PUT") {
    body = rest.unwrap
      ? input[rest.unwrap]
      : Object.fromEntries(Object.entries(input).filter(([name, value]) => !pathFields.has(name) && !queryFields.has(name) && value !== undefined));
  }
  const qs = query.toString();
  return { url: qs ? `${path}?${qs}` : path, method: rest.method, body };
}

/**
 * Every spec with a REST mapping becomes a WebMCP tool that calls the same route with the signed-in session,
 * so the browser copilot gets the data and write tools the MCP server has without a second implementation.
 */
export function restBridgeTools(deps: BridgeDeps = {}, specs: ToolSpec[] = allSpecs): WebMcpTool[] {
  return specs.filter((spec) => spec.rest).map((spec) => toWebMcpTool(spec, async (input, options) => {
    if (spec.annotations.destructiveHint && deps.confirm && !(await deps.confirm(spec.title))) {
      throw new ToolError("user_declined", "The user declined this action.");
    }
    const { url, method, body } = buildRequest(spec, input);
    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl(url, {
      method,
      credentials: "same-origin",
      // A cancelled tool call must not leave a write running in the background.
      signal: options?.signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: unknown } | null;
      throw new ToolError(typeof failure?.error === "string" ? failure.error : `http_${response.status}`, `${method} ${url} failed with ${response.status}${failure?.error ? `: ${JSON.stringify(failure.error)}` : ""}`);
    }
    if (method !== "GET") deps.onWrite?.(spec);
    return response.status === 204 ? { ok: true } : response.json();
  }));
}
