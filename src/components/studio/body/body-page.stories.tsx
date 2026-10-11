import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { fabricatedInBodyMetrics } from "@/data/seed-inbody";
import { buildBodyComposition } from "@/domain/body-composition";
import { timelineEventSchema } from "@/domain/events";
import type { InBodyEvent } from "@/domain/inbody";
import { BodyPage } from "./body-page";

type Scenario = "populated" | "single" | "empty" | "loading" | "error";

const daysAgo = (days: number) => new Date(Date.now() - days * 864e5);
const sheet = (id: string, scale: 0 | 1, days: number, weight: number) => timelineEventSchema.parse({
  id,
  type: "inbody",
  occurredAt: daysAgo(days).toISOString(),
  timezone: "Europe/Prague",
  source: { assetId: "5b7f2a40-1c8e-4d6a-9f3b-2e1d0c9b8a77", mimeType: "image/jpeg", fileName: "sheet.jpg" },
  report: { device: "InBody270" },
  extraction: { method: "mcp_agent", reviewed: days > 40 },
  metrics: fabricatedInBodyMetrics(scale).map((metric) => (metric.key === "weight" ? { ...metric, value: weight } : metric))
}) as InBodyEvent;

const events = [
  sheet("a0000000-0000-4000-8000-000000000001", 0, 200, 79),
  sheet("a0000000-0000-4000-8000-000000000002", 0, 130, 75.3),
  sheet("a0000000-0000-4000-8000-000000000003", 1, 65, 74.9),
  sheet("a0000000-0000-4000-8000-000000000004", 1, 4, 78.8)
];

const context = {
  photos: [{ id: "b0000000-0000-4000-8000-000000000001", occurredAt: daysAgo(100) }, { id: "b0000000-0000-4000-8000-000000000002", occurredAt: daysAgo(66) }],
  measurements: [{ id: "c0000000-0000-4000-8000-000000000001", occurredAt: daysAgo(63), values: { weightKg: 75, waistCm: 79, chestCm: 101 } }],
  food: Array.from({ length: 40 }, (_, index) => ({
    occurredAt: daysAgo(190 - index * 4),
    timezone: "Europe/Prague",
    nutrients: [{ key: "energy_kcal", value: 2300 + (index % 5) * 60 }, { key: "protein", value: 150 }, { key: "fat", value: 70 }, { key: "carbohydrates", value: 260 }]
  })),
  steps: Array.from({ length: 90 }, (_, index) => ({ date: daysAgo(199 - index).toISOString().slice(0, 10), steps: 7000 + (index % 7) * 500 })),
  workouts: Array.from({ length: 30 }, (_, index) => ({ date: daysAgo(198 - index * 6).toISOString().slice(0, 10), setCount: 20, tonnageKg: 5200 })),
  timezone: "Europe/Prague",
  metrics: "all" as const
};

const tests = (list: InBodyEvent[]) => buildBodyComposition({ ...context, events: list });

function respond(url: string, scenario: Scenario): Promise<Response> {
  if (scenario === "loading") return new Promise(() => undefined);
  if (scenario === "error") return Promise.resolve(Response.json({ error: "boom" }, { status: 500 }));
  if (url.includes("/api/body/inbody")) {
    return Promise.resolve(Response.json({ tests: scenario === "empty" ? [] : scenario === "single" ? tests(events.slice(-1)) : tests(events) }));
  }
  return Promise.resolve(Response.json({}, { status: 404 }));
}

/** Serves the Body endpoint from fixtures for one scenario. */
const withApi = (scenario: Scenario): Decorator => function BodyApi(Story) {
  const [client] = useState(() => {
    globalThis.fetch = ((input: RequestInfo | URL) => respond(String(input instanceof Request ? input.url : input), scenario)) as typeof fetch;
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="never">
        <div data-surface="studio" className="min-h-screen"><Story /></div>
      </MotionConfig>
    </QueryClientProvider>
  );
};

const meta = {
  title: "Studio/Body",
  component: BodyPage,
  args: { locale: "ru", timezone: "Europe/Prague" },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } }
} satisfies Meta<typeof BodyPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { decorators: [withApi("populated")] };
export const PopulatedEnglish: Story = { args: { locale: "en" }, decorators: [withApi("populated")] };
export const PopulatedCzech: Story = { args: { locale: "cs" }, decorators: [withApi("populated")] };
export const SingleTest: Story = { decorators: [withApi("single")] };
export const Empty: Story = { decorators: [withApi("empty")] };
export const Loading: Story = { decorators: [withApi("loading")] };
export const LoadError: Story = { decorators: [withApi("error")] };
