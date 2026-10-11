import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));
vi.mock("@/lib/current-user", () => ({ getCurrentUserId: async () => "demo-user" }));

let GET: typeof import("./route").GET;
let upsertExercise: typeof import("@/data/exercise-repository").upsertExercise;

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  ({ GET } = await import("./route"));
  ({ upsertExercise } = await import("@/data/exercise-repository"));
});

describe("GET /api/exercises/facets", () => {
  it("tallies muscles, equipment and movement patterns of the caller's catalog", async () => {
    await upsertExercise("demo-user", { name: "Facet Bench", primaryMuscles: ["chest"], equipment: "barbell", movementPattern: "push" });
    await upsertExercise("demo-user", { name: "Facet Fly", primaryMuscles: ["chest"], equipment: "cable", movementPattern: "push" });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json() as { total: number; muscles: Array<{ value: string; count: number }>; movementPatterns: Array<{ value: string; count: number }> };
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.muscles.find((facet) => facet.value === "chest")?.count).toBeGreaterThanOrEqual(2);
    expect(body.movementPatterns.find((facet) => facet.value === "push")?.count).toBeGreaterThanOrEqual(2);
  });
});
