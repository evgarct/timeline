import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "feedback-owner";
const otherUser = "feedback-other";

let repo: typeof import("./feedback-repository");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  repo = await import("./feedback-repository");
});

const input = (summary: string, extra: Record<string, unknown> = {}) => ({ category: "friction" as const, summary, ...extra });

describe("feedback repository", () => {
  it("stores structured feedback as new and lists it newest first with filters", async () => {
    const first = await repo.createFeedback(userId, input("list_events is slow", { tool: "list_events", severity: "medium", details: "took 9s", expected: "under 1s", suggestion: "add an index", source: "mcp", client: "claude" }));
    expect(first.duplicate).toBe(false);
    expect(first.feedback).toMatchObject({ status: "new", tool: "list_events", severity: "medium", source: "mcp", client: "claude" });

    await repo.createFeedback(userId, input("Preview volume is great", { category: "works_well", tool: "preview_template_volume" }));
    const all = await repo.listFeedback(userId);
    expect(all.map((entry) => entry.summary)).toEqual(["Preview volume is great", "list_events is slow"]);
    expect((await repo.listFeedback(userId, { category: "works_well" })).map((entry) => entry.tool)).toEqual(["preview_template_volume"]);
    expect((await repo.listFeedback(userId, { tool: "list_events" })).length).toBe(1);
    expect((await repo.listFeedback(userId, { status: "done" })).length).toBe(0);
  });

  it("returns the existing entry for the same summary and tool on the same day", async () => {
    const first = await repo.createFeedback(userId, input("Dedupe me", { tool: "get_template" }));
    const again = await repo.createFeedback(userId, input("  dedupe   ME ", { tool: "get_template" }));
    expect(again.duplicate).toBe(true);
    expect(again.feedback.id).toBe(first.feedback.id);
    const otherTool = await repo.createFeedback(userId, input("Dedupe me", { tool: "get_workout_session" }));
    expect(otherTool.duplicate).toBe(false);
  });

  it("keeps feedback owner-scoped", async () => {
    const mine = await repo.createFeedback(userId, input("Mine only"));
    expect((await repo.listFeedback(otherUser)).length).toBe(0);
    expect(await repo.getFeedback(otherUser, mine.feedback.id)).toBeUndefined();
    expect(await repo.updateFeedback(otherUser, mine.feedback.id, { status: "done" })).toBeUndefined();
  });

  it("updates status and resolution and counts by status", async () => {
    const created = await repo.createFeedback(userId, input("Triage me", { category: "bug", tool: "update_workout_session" }));
    const before = await repo.countFeedback(userId, "new");
    const updated = await repo.updateFeedback(userId, created.feedback.id, { status: "done", resolution: "Fixed in PR #99" });
    expect(updated).toMatchObject({ status: "done", resolution: "Fixed in PR #99" });
    expect(await repo.countFeedback(userId, "new")).toBe(before - 1);
    await expect(repo.updateFeedback(userId, created.feedback.id, {})).rejects.toThrow();
  });

  it("rejects invalid input and rate-limits a looping agent", async () => {
    await expect(repo.createFeedback(userId, { category: "nope", summary: "x" } as never)).rejects.toThrow();
    await expect(repo.createFeedback(userId, input(""))).rejects.toThrow();
    for (let index = 0; index < 40; index += 1) {
      try { await repo.createFeedback("loop-user", input(`Loop entry ${index}`)); } catch (error) {
        expect((error as Error).message).toBe("rate_limited");
        expect(index).toBe(30);
        return;
      }
    }
    throw new Error("expected the rate limit to trigger");
  });
});
