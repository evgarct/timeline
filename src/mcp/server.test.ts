import { beforeAll, describe, expect, it, vi } from "vitest";
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
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  ({ createTimelineMcpServer } = await import("./server"));
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
