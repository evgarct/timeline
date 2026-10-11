import { afterEach, describe, expect, it, vi } from "vitest";
import { allSpecs } from "@/lib/agent/specs";
import { studioSpecs } from "@/lib/agent/studio-specs";
import { buildRequest, restBridgeTools } from "./bridge";
import { getModelContext, registerTools, ToolError, toWebMcpTool, type WebMcpTool } from "./model-context";

afterEach(() => vi.unstubAllGlobals());

function fakeContext() {
  const tools = new Map<string, { execute: (input: Record<string, unknown>) => Promise<unknown>; signal?: AbortSignal }>();
  return {
    tools,
    registerTool: vi.fn((tool: { name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }, options?: { signal?: AbortSignal }) => {
      if (tools.has(tool.name)) throw new Error("duplicate");
      tools.set(tool.name, { execute: tool.execute, signal: options?.signal });
      options?.signal?.addEventListener("abort", () => tools.delete(tool.name));
    })
  };
}

const echo = (name: string, execute: WebMcpTool["execute"] = async (input) => ({ echoed: input })): WebMcpTool => ({
  name, description: "test tool", inputSchema: { type: "object" }, execute
});

describe("getModelContext", () => {
  it("finds document.modelContext, falls back to navigator.modelContext and survives neither", () => {
    expect(getModelContext()).toBeUndefined();
    const nav = fakeContext();
    vi.stubGlobal("navigator", { modelContext: nav });
    expect(getModelContext()).toBe(nav);
    const doc = fakeContext();
    vi.stubGlobal("document", { modelContext: doc });
    expect(getModelContext()).toBe(doc);
  });
});

describe("registerTools", () => {
  it("registers each tool with a shared abort signal and withdraws them on dispose", async () => {
    const context = fakeContext();
    const dispose = registerTools([echo("a"), echo("b")], context);
    expect([...context.tools.keys()]).toEqual(["a", "b"]);
    expect(await context.tools.get("a")?.execute({ x: 1 })).toEqual({ echoed: { x: 1 } });
    dispose();
    expect(context.tools.size).toBe(0);
  });

  it("is a no-op without WebMCP and keeps going when one registration throws", () => {
    expect(registerTools([echo("a")], undefined)()).toBeUndefined();
    const context = fakeContext();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    registerTools([echo("a"), echo("a"), echo("b")], context);
    expect([...context.tools.keys()]).toEqual(["a", "b"]);
    warn.mockRestore();
  });

  it("turns expected refusals into structured results and caps huge ones", async () => {
    const context = fakeContext();
    registerTools([
      echo("refuse", async () => { throw new ToolError("user_declined", "no"); }),
      echo("crash", async () => { throw new Error("boom"); }),
      echo("huge", async () => ({ text: "x".repeat(70_000) }))
    ], context);
    expect(await context.tools.get("refuse")?.execute({})).toEqual({ ok: false, error: "user_declined", message: "no" });
    expect(await context.tools.get("crash")?.execute({})).toEqual({ ok: false, error: "tool_failed", message: "boom" });
    expect(await context.tools.get("huge")?.execute({})).toMatchObject({ ok: false, error: "result_too_large" });
  });
});

describe("toWebMcpTool", () => {
  it("generates the JSON Schema, maps hints and validates input before executing", async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const tool = toWebMcpTool(studioSpecs.builder_move_exercise, execute);
    expect(tool.inputSchema).toMatchObject({ type: "object", required: expect.arrayContaining(["itemKey", "toIndex"]) });
    await expect(tool.execute({ itemKey: "a", toIndex: -1 })).rejects.toMatchObject({ code: "invalid_input" });
    await tool.execute({ itemKey: "a", toIndex: 2 });
    expect(execute).toHaveBeenCalledWith({ itemKey: "a", toIndex: 2 }, undefined);

    const save = toWebMcpTool(studioSpecs.builder_save, execute, { consequential: true });
    expect(save.annotations?.consequentialHint).toBe(true);
    expect(toWebMcpTool(studioSpecs.builder_get_draft, execute).annotations?.readOnlyHint).toBe(true);
  });
});

describe("REST bridge", () => {
  const byName = Object.fromEntries(allSpecs.map((spec) => [spec.name, spec]));

  it("builds path, query and body from the spec mapping", () => {
    expect(buildRequest(byName.get_template, { id: "abc" })).toEqual({ url: "/api/templates/abc", method: "GET", body: undefined });
    expect(buildRequest(byName.list_workout_sessions, { limit: 5, from: "2026-10-01" })).toEqual({ url: "/api/workouts?limit=5&from=2026-10-01", method: "GET", body: undefined });
    const unwrapped = buildRequest(byName.upsert_exercise, { exercise: { name: "Row" } });
    expect(unwrapped.body).toEqual({ name: "Row" });
    const wrapped = buildRequest(byName.update_workout_session, { eventId: "e1", timezone: "UTC", sets: [] });
    expect(wrapped).toMatchObject({ url: "/api/workouts/e1", method: "PUT", body: { timezone: "UTC", sets: [] } });
  });

  it("calls the route with the session cookie, reports errors and asks before destructive tools", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => (
      String(url).includes("missing") ? Response.json({ error: "not_found" }, { status: 404 }) : init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ id: "t1" })
    )) as unknown as typeof fetch;
    const confirm = vi.fn(async () => false);
    const onWrite = vi.fn();
    const tools = Object.fromEntries(restBridgeTools({ fetchImpl, confirm, onWrite }).map((tool) => [tool.name, tool]));

    expect(await tools.get_template.execute({ id: "11111111-1111-4111-8111-111111111111" })).toEqual({ id: "t1" });
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ credentials: "same-origin" });
    await expect(tools.get_template.execute({ id: "22222222-2222-4222-8222-222222222222-missing".slice(0, 36) })).resolves.toBeDefined();

    await expect(tools.delete_workout_template.execute({ id: "11111111-1111-4111-8111-111111111111" })).rejects.toMatchObject({ code: "user_declined" });
    expect(onWrite).not.toHaveBeenCalled();
    confirm.mockResolvedValueOnce(true);
    expect(await tools.delete_workout_template.execute({ id: "11111111-1111-4111-8111-111111111111" })).toEqual({ ok: true });
    expect(onWrite).toHaveBeenCalledTimes(1);
  });

  it("passes the call's abort signal to the request", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ items: [] })) as unknown as typeof fetch;
    const tools = Object.fromEntries(restBridgeTools({ fetchImpl }).map((tool) => [tool.name, tool]));
    const controller = new AbortController();
    await tools.list_workout_templates.execute({}, { signal: controller.signal });
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });

  it("exposes only specs with a REST mapping", () => {
    const names = restBridgeTools().map((tool) => tool.name);
    expect(names).toContain("search_exercises");
    expect(names).not.toContain("rename_workout_template");
  });
});
