import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));
vi.mock("@/lib/current-user", () => ({ getCurrentUserId: async () => "feedback-routes-owner" }));

let list: typeof import("./feedback/route");
let one: typeof import("./feedback/[id]/route");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  list = await import("./feedback/route");
  one = await import("./feedback/[id]/route");
});

const post = (body: unknown, headers: Record<string, string> = {}) => new Request("http://x/api/feedback", { method: "POST", body: JSON.stringify(body), headers });

describe("feedback routes", () => {
  it("creates, dedupes, lists with filters and triages", async () => {
    const created = await list.POST(post({ category: "bug", tool: "get_template", summary: "get_template returns 500" }, { "x-form-source": "webmcp", "x-form-page": "/ru/studio" }));
    expect(created.status).toBe(201);
    const entry = await created.json() as { id: string; status: string; source: string; page?: string; duplicate: boolean };
    expect(entry).toMatchObject({ status: "new", source: "webmcp", page: "/ru/studio", duplicate: false });

    const again = await list.POST(post({ category: "bug", tool: "get_template", summary: "get_template returns 500" }));
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ id: entry.id, duplicate: true });

    const filtered = await (await list.GET(new Request("http://x/api/feedback?status=new&category=bug&tool=get_template"))).json() as { items: Array<{ id: string }> };
    expect(filtered.items.map((item) => item.id)).toEqual([entry.id]);

    const params = { params: Promise.resolve({ id: entry.id }) };
    const updated = await one.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ status: "triaged", resolution: "Looking at it" }) }), params);
    expect(await updated.json()).toMatchObject({ status: "triaged", resolution: "Looking at it" });
    expect(await (await one.GET(new Request("http://x"), params)).json()).toMatchObject({ status: "triaged" });
  });

  it("takes provenance from the transport headers, never from the body", async () => {
    const forged = await list.POST(post({ category: "other", summary: "forged provenance", source: "mcp", page: "/evil" }));
    expect(await forged.json()).toMatchObject({ source: "rest" });
    const body = await (await list.POST(post({ category: "other", summary: "forged provenance two", source: "mcp", page: "/evil" }))).json() as { page?: string };
    expect(body.page).toBeUndefined();
    const spoofedPage = await (await list.POST(post({ category: "other", summary: "page without webmcp" }, { "x-form-page": "/evil" }))).json() as { page?: string; source: string };
    expect(spoofedPage).toMatchObject({ source: "rest" });
    expect(spoofedPage.page).toBeUndefined();
  });

  it("counts new entries beyond the list limit", async () => {
    const counts = await import("./feedback/counts/route");
    const body = await (await counts.GET()).json() as { new: number; total: number };
    expect(body.new).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThanOrEqual(body.new);
  });

  it("validates input and unknown ids", async () => {
    expect((await list.POST(post({ category: "rant", summary: "x" }))).status).toBe(400);
    expect((await list.GET(new Request("http://x/api/feedback?status=bogus"))).status).toBe(400);
    const missing = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000404" }) };
    expect((await one.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ status: "done" }) }), missing)).status).toBe(404);
    expect((await one.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({}) }), missing)).status).toBe(400);
  });

  it("answers 429 when an agent floods the inbox", async () => {
    let status = 201;
    for (let index = 0; index < 40 && status !== 429; index += 1) {
      status = (await list.POST(post({ category: "other", summary: `flood ${index}` }))).status;
    }
    expect(status).toBe(429);
  });
});
