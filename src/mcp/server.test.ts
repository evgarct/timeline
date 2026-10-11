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

describe("agent tools added with the spec registry", () => {
  const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
  const isError = (response: unknown) => Boolean((response as { isError?: boolean }).isError);
  const call = (client: Awaited<ReturnType<typeof connectClient>>, name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const idIn = (value: string) => value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0] as string;

  it("advertises read-only and destructive hints from the registry", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    for (const name of ["get_template", "get_workout_session", "list_exercise_alternatives", "preview_template_volume", "get_daily_activity", "list_events"]) {
      expect(byName[name], name).toBeDefined();
      expect(byName[name].annotations?.readOnlyHint, name).toBe(true);
    }
    for (const name of ["delete_workout_session", "delete_workout_template"]) expect(byName[name].annotations?.destructiveHint, name).toBe(true);
  });

  it("round-trips a session: log, read, correct and delete, always visible in the text content", async () => {
    const client = await connectClient();
    const created = text(await call(client, "upsert_exercise", { exercise: { name: "Agent Row", primaryMuscles: ["lats"], movementPattern: "pull", equipment: "cable" } }));
    const exerciseId = idIn(created);
    const logged = text(await call(client, "record_workout_session", {
      occurredAt: "2026-08-20T10:00:00Z", timezone: "UTC", muscleGroups: ["lats"],
      sets: [{ exerciseId, setIndex: 1, reps: 10, weightKg: 50, completed: true, setType: "working" }]
    }));
    const eventId = idIn(logged);

    const read = text(await call(client, "get_workout_session", { eventId }));
    expect(read).toContain(eventId);
    expect(read).toContain("Agent Row");
    expect(read).toContain("10x50");
    // Every set field must be readable from the text alone, because update_workout_session replaces the whole list.
    expect(read).toContain('"setIndex":1');
    expect(read).toContain('"completed":true');

    const updated = text(await call(client, "update_workout_session", {
      eventId, occurredAt: "2026-08-20T10:00:00Z", timezone: "UTC", muscleGroups: ["lats"], exertion: 4,
      sets: [{ exerciseId, setIndex: 1, reps: 12, weightKg: 52.5, completed: true, setType: "working" }]
    }));
    expect(updated).toContain("Workout updated");
    expect(text(await call(client, "get_workout_session", { eventId }))).toContain("12x52.5");

    const listed = text(await call(client, "list_workout_sessions", { limit: 10, from: "2026-08-20", to: "2026-08-20" }));
    expect(listed).toContain(eventId);
    expect(text(await call(client, "list_workout_sessions", { limit: 10, from: "2026-08-21" }))).not.toContain(eventId);
    expect(isError(await call(client, "list_workout_sessions", { limit: 10, from: "garbage" }))).toBe(true);

    expect(text(await call(client, "delete_workout_session", { eventId }))).toContain(eventId);
    expect(isError(await call(client, "get_workout_session", { eventId }))).toBe(true);
  });

  it("reads and duplicates templates, previews volume and finds alternatives", async () => {
    const client = await connectClient();
    const bench = idIn(text(await call(client, "upsert_exercise", { exercise: { name: "Agent Bench", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], movementPattern: "push", equipment: "barbell" } })));
    const dumbbell = idIn(text(await call(client, "upsert_exercise", { exercise: { name: "Agent Dumbbell Press", primaryMuscles: ["chest"], movementPattern: "push", equipment: "dumbbell" } })));
    const template = text(await call(client, "upsert_workout_template", { template: { name: "Agent Push", exercises: [{ exerciseId: bench, sets: 4 }] } }));
    const templateId = idIn(template);

    expect(text(await call(client, "get_template", { id: templateId }))).toContain("Agent Push");
    const copy = text(await call(client, "duplicate_workout_template", { id: templateId }));
    expect(copy).toContain("Agent Push (copy)");
    expect(idIn(copy)).not.toBe(templateId);

    const preview = text(await call(client, "preview_template_volume", { exercises: [{ exerciseId: bench, sets: 4 }] }));
    expect(preview).toContain("chest 4");
    expect(preview).toContain("triceps 2");
    expect(isError(await call(client, "preview_template_volume", { exercises: [{ exerciseId: "00000000-0000-4000-8000-000000000009", sets: 2 }] }))).toBe(true);

    const alternatives = text(await call(client, "list_exercise_alternatives", { exerciseId: bench }));
    expect(alternatives).toContain("Agent Dumbbell Press");
    expect(alternatives).toContain(dumbbell);
  });

  it("filters timeline events and validates ranges", async () => {
    const client = await connectClient();
    await call(client, "create_event", { event: { id: "5b0e7c4a-2f61-4d6e-8a37-9a1c3e5f7b21", type: "workout", occurredAt: "2033-01-10T10:00:00.000Z", timezone: "UTC", completed: true, muscleGroups: ["abs"] } });
    const filtered = text(await call(client, "list_events", { limit: 20, type: "workout", from: "2033-01-01", to: "2033-01-31" }));
    expect(filtered).toContain("5b0e7c4a-2f61-4d6e-8a37-9a1c3e5f7b21");
    expect(text(await call(client, "list_events", { limit: 20, type: "measurements", from: "2033-01-01", to: "2033-01-31" }))).toBe("No events");
    expect(isError(await call(client, "list_events", { limit: 20, from: "2033-02-01", to: "2033-01-01" }))).toBe(true);
  });

  it("reports activity in a date range", async () => {
    const client = await connectClient();
    expect(text(await call(client, "get_daily_activity", { from: "2026-08-01", to: "2026-08-07" }))).toContain("No activity");
    expect(isError(await call(client, "get_daily_activity", { from: "2026-08-07", to: "2026-08-01" }))).toBe(true);
  });
});

describe("send_feedback, list_feedback and update_feedback", () => {
  const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
  const isError = (response: unknown) => Boolean((response as { isError?: boolean }).isError);
  const idIn = (value: string) => value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0] as string;

  it("tells agents about the feedback tool in the server instructions", async () => {
    const client = await connectClient();
    expect(client.getInstructions()).toContain("send_feedback");
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === "send_feedback")?.description).toContain("about 30 entries per hour at most");
    expect(tools.find((tool) => tool.name === "list_feedback")?.annotations?.readOnlyHint).toBe(true);
  });

  it("records feedback, reads it back with every field in the text, dedupes and triages", async () => {
    const client = await connectClient();
    const sent = text(await client.callTool({ name: "send_feedback", arguments: {
      category: "friction", severity: "medium", tool: "list_events", summary: "list_events cannot filter by muscle",
      details: "I wanted only chest workouts", expected: "a muscle filter", suggestion: "add muscleGroup to list_events",
      toolCalls: [{ tool: "list_events", outcome: "confusing", note: "no muscle field" }], client: "test-agent"
    } }));
    expect(sent).toContain("Feedback recorded");
    const id = idIn(sent);

    const again = text(await client.callTool({ name: "send_feedback", arguments: { category: "friction", tool: "list_events", summary: "List_events cannot filter by muscle" } }));
    expect(again).toContain("Already recorded");
    expect(again).toContain(id);

    const listed = text(await client.callTool({ name: "list_feedback", arguments: { tool: "list_events" } }));
    for (const part of [id, "new", "friction/medium", "I wanted only chest workouts", "a muscle filter", "add muscleGroup to list_events", "list_events=confusing", "test-agent", "source: mcp"]) expect(listed).toContain(part);

    const done = text(await client.callTool({ name: "update_feedback", arguments: { id, status: "done", resolution: "Added in PR #123" } }));
    expect(done).toContain("done");
    expect(done).toContain("Added in PR #123");
    expect(text(await client.callTool({ name: "list_feedback", arguments: { status: "new", tool: "list_events" } }))).toBe("No feedback entries");
    expect(isError(await client.callTool({ name: "update_feedback", arguments: { id } }))).toBe(true);
    expect(isError(await client.callTool({ name: "update_feedback", arguments: { id: "00000000-0000-4000-8000-000000000321", status: "done" } }))).toBe(true);
  });

  it("patches a template schedule, shows names in templates and reports the week plan as text", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
    const idOf = (value: string) => /id: ([0-9a-f-]{36})/.exec(value)![1];

    const created = text(await client.callTool({
      name: "upsert_exercise",
      arguments: { exercise: { name: "Plan Press", primaryMuscles: ["chest"], videoUrl: "https://youtu.be/dQw4w9WgXcQ" } }
    }));
    expect(created).toContain("Created exercise");
    const exerciseId = idOf(created);

    const again = text(await client.callTool({ name: "upsert_exercise", arguments: { exercise: { name: "plan press", equipment: "barbell" } } }));
    expect(again).toContain("Matched the existing exercise");
    expect(again).toContain("equipment");

    const found = text(await client.callTool({ name: "search_exercises", arguments: { query: "plan press" } }));
    expect(found).toContain("| video");
    expect(found).not.toContain("instructions");
    expect(text(await client.callTool({ name: "get_exercise", arguments: { exerciseId } }))).toContain("Video: https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    const template = text(await client.callTool({
      name: "upsert_workout_template",
      arguments: { template: { name: "Plan Day", exercises: [{ exerciseId, sets: 3 }] } }
    }));
    const templateId = idOf(template);

    const patched = text(await client.callTool({
      name: "update_workout_template",
      arguments: { id: templateId, schedule: { weekdays: [1, 4] }, exercises: [{ index: 0, sets: 4, note: "pause the rep" }] }
    }));
    expect(patched).toContain("weekdays 1,4");
    expect(patched).toContain('"name":"Plan Press"');
    expect(patched).toContain('"sets":4');

    const listed = text(await client.callTool({ name: "list_workout_templates", arguments: {} }));
    expect(listed).toContain('"name":"Plan Press"');

    // 2026-08-29 is a Saturday: the Monday and Thursday are planned and the week starts on 2026-08-24
    const week = text(await client.callTool({ name: "get_week_plan", arguments: { timezone: "UTC" } }));
    expect(week).toContain("Week of 2026-08-24");
    expect(week).toContain("2026-08-24 (Mon): missed | planned: Plan Day");
    expect(week).toContain("Unplanned days:");

    expect((await client.callTool({ name: "update_workout_template", arguments: { id: templateId, exercises: [{ sets: 2 }] } })).isError).toBe(true);
  });

  it("hides signed photo URLs in get_today unless asked", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
    await client.callTool({
      name: "create_event",
      arguments: {
        event: {
          type: "progress_photo", occurredAt: "2026-08-29T08:00:00.000Z", timezone: "UTC",
          photos: [{ id: "p1", url: "https://signed.example.test/full.jpg?sig=abc", thumbnailUrl: "https://signed.example.test/thumb.jpg?sig=abc", alt: "Front" }]
        }
      }
    });
    const plain = text(await client.callTool({ name: "get_today", arguments: { timezone: "UTC" } }));
    expect(plain).not.toContain("/demo/progress-front.png");
    expect(plain).toContain('"photoCount":3');
    const withUrls = text(await client.callTool({ name: "get_today", arguments: { timezone: "UTC", includePhotoUrls: true } }));
    expect(withUrls).toContain("/demo/progress-front.png");
  });

  it("offers create_photo_upload and says plainly when photo storage is not configured", async () => {
    const client = await connectClient();
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toContain("create_photo_upload");
    const response = await client.callTool({ name: "create_photo_upload", arguments: {} }) as { isError?: boolean; content: Array<{ text: string }> };
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("storage_not_configured");
  });

  it("stores an InBody test sent as key+value and reads it back as text only", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
    const id = "9d2f6a30-7a1b-4c55-8e0f-3b6c1d2e4f50";
    const created = await client.callTool({
      name: "create_event",
      arguments: {
        event: {
          id, type: "inbody", occurredAt: "2026-08-25T07:30:00.000Z", timezone: "Europe/Prague",
          source: { url: "/demo/inbody-sample.jpg", mimeType: "image/jpeg", fileName: "sheet.jpg" },
          report: { device: "InBody270", heightCm: 180 },
          extraction: { method: "mcp_agent", reviewed: false },
          metrics: [
            { key: "weight", value: 80.4, referenceMin: 60.2, referenceMax: 81.4 },
            { key: "skeletal_muscle_mass", value: 39.5 },
            { key: "percent_body_fat", value: 12.1, evaluation: "normal" },
            { key: "lean_mass_kg", segment: "left_arm", value: 4.2, evaluation: "normal" }
          ]
        }
      }
    });
    expect(text(created)).toContain(id);
    expect(text(created)).toContain("4 readings");

    // a segmental reading without its segment is refused with a message that says what is missing
    const bad = await client.callTool({ name: "create_event", arguments: { event: { id: "1d2f6a30-7a1b-4c55-8e0f-3b6c1d2e4f51", type: "inbody", occurredAt: "2026-08-21T07:30:00.000Z", timezone: "UTC", source: { url: "/x.jpg", mimeType: "image/jpeg", fileName: "x.jpg" }, extraction: { method: "manual", reviewed: true }, metrics: [{ key: "lean_mass_kg", value: 4 }] } } }) as { isError?: boolean };
    expect(bad.isError).toBe(true);

    const event = text(await client.callTool({ name: "get_event", arguments: { id } }));
    expect(event).toContain("weight 80.4 kg (ref 60.2-81.4)");
    expect(event).toContain("lean_mass_kg[left_arm] 4.2 kg normal");
    expect(event).toContain("not yet reviewed");

    const listed = text(await client.callTool({ name: "list_events", arguments: { type: "inbody" } }));
    expect(listed).toContain(`${id} | inbody`);
    expect(listed).toContain("weight 80.4 kg");

    const today = text(await client.callTool({ name: "get_today", arguments: { timezone: "UTC" } }));
    expect(today).toContain("last InBody 2026-08-25");
    expect(today).not.toContain('"key":"exercise_kcal_golf"');
  });

  it("answers get_body_composition with changes and the context between tests, in the text", async () => {
    const client = await connectClient();
    const text = (response: unknown) => (response as { content: Array<{ text: string }> }).content[0].text;
    const answer = text(await client.callTool({ name: "get_body_composition", arguments: { timezone: "Europe/Prague" } }));
    expect(answer).toContain("InBody tests, oldest first");
    expect(answer).toMatch(/weight 76\.1 kg \(\+1\.1\)/);
    expect(answer).toContain("diet logged");
    expect((await client.callTool({ name: "get_body_composition", arguments: { timezone: "Not/AZone" } })).isError).toBe(true);
    const all = text(await client.callTool({ name: "get_body_composition", arguments: { metrics: "all" } }));
    expect(all).toContain("per segment:");
    expect(all).toContain("impedance_ohm:trunk@20");
  });

  it("offers create_inbody_upload and get_inbody_original, and is plain when storage is not configured", async () => {
    const client = await connectClient();
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toEqual(expect.arrayContaining(["create_inbody_upload", "get_body_composition", "get_inbody_original"]));
    const upload = await client.callTool({ name: "create_inbody_upload", arguments: {} }) as { isError?: boolean; content: Array<{ text: string }> };
    expect(upload.isError).toBe(true);
    expect(upload.content[0].text).toContain("storage_not_configured");
    const original = await client.callTool({ name: "get_inbody_original", arguments: { eventId: "7e5839e1-0274-4969-be96-a96e407fd9bf" } }) as { isError?: boolean; content: Array<{ text: string }> };
    expect(original.isError).toBe(true);
    expect(original.content[0].text).toContain("original_unavailable");
  });

  it("rejects an invalid category through the tool schema", async () => {
    const client = await connectClient();
    await expect(client.callTool({ name: "send_feedback", arguments: { category: "rant", summary: "x" } })).resolves.toMatchObject({ isError: true });
  });
});
