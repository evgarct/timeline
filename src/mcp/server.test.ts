import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "mcp-test-owner";

let createTimelineMcpServer: typeof import("./server").createTimelineMcpServer;

async function connectClient() {
  const server = createTimelineMcpServer(userId);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"));
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  ({ createTimelineMcpServer } = await import("./server"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("timeline MCP server", () => {
  it("does not advertise an MCP-app UI resource on tools or resources", async () => {
    const client = await connectClient();

    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect((tool._meta as Record<string, unknown> | undefined)?.["ui/resourceUri"]).toBeUndefined();
      expect((tool._meta as { ui?: unknown } | undefined)?.ui).toBeUndefined();
    }

    // The widget was the only registered resource; the server no longer exposes a resources capability.
    expect(client.getServerCapabilities()?.resources).toBeUndefined();
  });

  it("puts ids and data into the text content, because Claude clients ignore structuredContent", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;

    const created = await client.callTool({
      name: "create_event",
      arguments: {
        event: {
          id: "7c1d3b52-5f0a-4f0e-9d3e-0f4f8c1a2b11", type: "workout", occurredAt: "2026-08-28T10:00:00.000Z",
          timezone: "UTC", completed: true, muscleGroups: ["chest"], exertion: 4, mood: "good", note: "felt strong"
        }
      }
    });
    expect(text(created)).toContain("7c1d3b52-5f0a-4f0e-9d3e-0f4f8c1a2b11");

    const listed = text(await client.callTool({ name: "list_events", arguments: {} }));
    expect(listed).toContain("7c1d3b52-5f0a-4f0e-9d3e-0f4f8c1a2b11 | workout | 2026-08-28T10:00");
    expect(listed).toContain("difficulty 4/5");
    expect(listed).toContain("mood good");
    expect(listed).toContain("note: felt strong");

    // get_event has no custom text, so it now carries the full record as JSON
    const event = text(await client.callTool({ name: "get_event", arguments: { id: "7c1d3b52-5f0a-4f0e-9d3e-0f4f8c1a2b11" } }));
    expect(event).toContain('"muscleGroups":["chest"]');

    expect(text(await client.callTool({ name: "get_task_schedules", arguments: {} }))).toMatch(/schedules\n\[/);
  });

  it("lets an agent browse the exercise database by muscle and equipment and read the technique", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
    const add = async (exercise: Record<string, unknown>) => text(await client.callTool({ name: "upsert_exercise", arguments: { exercise } }));
    await add({ name: "Incline Dumbbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: "dumbbell", movementPattern: "push", searchAliases: ["жим лёжа с гантелями под углом"] });
    await add({ name: "Barbell Back Squat", primaryMuscles: ["quads"], equipment: "barbell", movementPattern: "squat" });
    const detail = await add({
      name: "Cable Fly", primaryMuscles: ["chest"], equipment: "cable", movementPattern: "push",
      instructions: ["Stand between the pulleys.", "Bring the handles together."], images: ["https://cdn.example.test/fly/0.jpg"]
    });
    const flyId = /id: ([0-9a-f-]{36})/.exec(detail)![1];

    const filters = text(await client.callTool({ name: "list_exercise_filters", arguments: {} }));
    expect(filters).toContain("chest (2)");
    expect(filters).toContain("dumbbell (1)");
    expect(filters).toContain("push (2)");

    // words in any order, narrowed by muscle; each line carries what an agent needs to choose
    const found = text(await client.callTool({ name: "search_exercises", arguments: { query: "press incline", muscle: "chest" } }));
    expect(found).toContain("Incline Dumbbell Press — chest (+triceps) | dumbbell | push | id: ");
    expect(found).not.toContain("Squat");
    expect(text(await client.callTool({ name: "search_exercises", arguments: { muscle: "quads" } }))).toContain("Barbell Back Squat");
    expect(text(await client.callTool({ name: "search_exercises", arguments: { query: "жим гантелями" } }))).toContain("Incline Dumbbell Press");
    expect(text(await client.callTool({ name: "search_exercises", arguments: { equipment: "cable", movementPattern: "push" } }))).toContain("Cable Fly");
    expect(text(await client.callTool({ name: "search_exercises", arguments: { muscle: "calves" } }))).toContain("No exercises matched");

    const full = text(await client.callTool({ name: "get_exercise", arguments: { exerciseId: flyId } }));
    expect(full).toContain("1. Stand between the pulleys.");
    expect(full).toContain("2. Bring the handles together.");
    expect(full).toContain("https://cdn.example.test/fly/0.jpg");
  });

  it("lets an agent find, rename and review workouts from text alone", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;

    const exerciseText = text(await client.callTool({
      name: "upsert_exercise", arguments: { exercise: { name: "Rename Test Press", primaryMuscles: ["chest"] } }
    }));
    const exercise = { id: /id: ([0-9a-f-]{36})/.exec(exerciseText)![1] };

    const saved = text(await client.callTool({
      name: "upsert_workout_template",
      arguments: { template: { name: "Пн 5.10", exercises: [{ exerciseId: exercise.id, sets: 3, repMin: 8, repMax: 10, weightKg: 40 }] } }
    }));
    const templateId = /id: ([0-9a-f-]{36})/.exec(saved)![1];

    // the list shows the id and the full exercises, so an agent can edit without guessing
    const listed = text(await client.callTool({ name: "list_workout_templates", arguments: {} }));
    expect(listed).toContain(templateId);
    expect(listed).toContain(exercise.id);
    expect(listed).toContain('"weightKg":40');

    const renamed = text(await client.callTool({ name: "rename_workout_template", arguments: { id: templateId, name: "Full Body" } }));
    expect(renamed).toContain('Renamed to "Full Body"');
    const after = text(await client.callTool({ name: "list_workout_templates", arguments: {} }));
    expect(after).toContain("Full Body");
    expect(after).toContain('"weightKg":40'); // exercises untouched by a rename

    await client.callTool({
      name: "record_workout_session",
      arguments: {
        occurredAt: "2026-08-29T09:00:00.000Z", timezone: "UTC", muscleGroups: ["chest"], note: "shoulder tight",
        exertion: 5, mood: "bad",
        sets: [{ exerciseId: exercise.id, setIndex: 1, reps: 8, weightKg: 40, rir: 1 }], idempotencyKey: "mcp-rename-1"
      }
    });
    const sessions = text(await client.callTool({ name: "list_workout_sessions", arguments: { limit: 5 } }));
    expect(sessions).toContain("2026-08-29");
    expect(sessions).toContain("difficulty 5/5");
    expect(sessions).toContain("mood bad");
    expect(sessions).toContain("note: shoulder tight");
    expect(sessions).toContain("Rename Test Press: 8x40 RIR1");

    expect((await client.callTool({ name: "rename_workout_template", arguments: { id: "11111111-1111-4111-8111-111111111111", name: "x" } })).isError).toBe(true);
  });

  it("returns daily macro totals as readable text from get_nutrient_details and get_today", async () => {
    const client = await connectClient();

    await client.callTool({
      name: "record_ad_hoc_food",
      arguments: {
        mealType: "lunch",
        name: "Test plate",
        quantityLabel: "1 plate",
        nutrients: [
          { key: "energy_kcal", label: "Energy", value: 500, unit: "kcal", provenance: "stated" },
          { key: "protein", label: "Protein", value: 30, unit: "g", provenance: "stated" }
        ],
        type: { en: "Meal" },
        genericName: { en: "Test plate" },
        occurredAt: "2026-08-29T12:00:00.000Z",
        timezone: "UTC",
        idempotencyKey: "mcp-test-1"
      }
    });

    const details = await client.callTool({
      name: "get_nutrient_details",
      arguments: { date: "2026-08-29", timezone: "UTC" }
    });
    const detailsText = (details.content as Array<{ type: string; text: string }>)[0].text;
    expect(detailsText).toContain("500 kcal");
    expect(detailsText).toContain("30.0g protein");

    const today = await client.callTool({ name: "get_today", arguments: { timezone: "UTC" } });
    const todayText = (today.content as Array<{ type: string; text: string }>)[0].text;
    expect(todayText).toContain("500 kcal");
    expect((today.structuredContent as { data: { nutrition?: { totals: unknown[] } } }).data.nutrition?.totals).toBeTruthy();
  });
});
