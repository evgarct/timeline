import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));
vi.mock("@/lib/current-user", () => ({ getCurrentUserId: async () => "agent-routes-owner" }));

let events: typeof import("./events/route");
let openapi: typeof import("./openapi.json/route");
let preview: typeof import("./templates/preview-volume/route");
let duplicate: typeof import("./templates/[id]/duplicate/route");
let alternatives: typeof import("./exercises/[id]/alternatives/route");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  events = await import("./events/route");
  openapi = await import("./openapi.json/route");
  preview = await import("./templates/preview-volume/route");
  duplicate = await import("./templates/[id]/duplicate/route");
  alternatives = await import("./exercises/[id]/alternatives/route");
});

const missingId = "00000000-0000-4000-8000-000000000123";

describe("agent REST routes", () => {
  it("rejects a bad event type and a reversed window", async () => {
    expect((await events.GET(new Request("http://x/api/events?type=banana"))).status).toBe(400);
    expect((await events.GET(new Request("http://x/api/events?from=2030-02-01&to=2030-01-01"))).status).toBe(400);
    expect((await events.GET(new Request("http://x/api/events?type=workout&from=2030-01-01&limit=5"))).status).toBe(200);
  });

  it("serves a public OpenAPI document built from the spec registry", async () => {
    const response = await openapi.GET(new Request("https://form.test/api/openapi.json"));
    const doc = await response.json() as { openapi: string; servers: Array<{ url: string }>; paths: Record<string, unknown> };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0].url).toBe("https://form.test");
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/api/templates/preview-volume", "/api/exercises/{exerciseId}/alternatives", "/api/templates/{id}/duplicate"]));
  });

  it("validates input and returns 404/422 for unknown ids", async () => {
    const json = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });
    expect((await preview.POST(json({ exercises: [] }))).status).toBe(400);
    expect((await preview.POST(json({ exercises: [{ exerciseId: missingId, sets: 3 }] }))).status).toBe(422);
    expect((await duplicate.POST(json({}), { params: Promise.resolve({ id: missingId }) })).status).toBe(404);
    expect((await alternatives.GET(new Request("http://x"), { params: Promise.resolve({ id: missingId }) })).status).toBe(404);
  });
});
