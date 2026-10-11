import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { Dashboard } from "./dashboard";

type Scenario = "populated" | "empty" | "loading" | "error";

const day = (offset: number) => new Date(Date.now() - offset * 864e5);
const monday = (weeksAgo: number) => {
  const date = day(weeksAgo * 7);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const benchId = "00000000-0000-4000-8000-000000000001";
const sessions = Array.from({ length: 16 }, (_, index) => ({
  eventId: `00000000-0000-4000-9000-0000000000${String(index).padStart(2, "0")}`,
  occurredAt: day(index * 3 + 1).toISOString(),
  timezone: "Europe/Prague",
  muscleGroups: ["chest", "shoulders", "triceps"],
  note: index === 0 ? "Felt strong" : null,
  exertion: 3,
  mood: "ok",
  exercises: [{ exerciseId: benchId, name: "Barbell Bench Press", sets: [0, 1, 2].map((set) => ({ reps: 8 - set, weightKg: 70 - index, completed: true, setType: "working", rir: 2 })) }],
  summary: { setCount: 3, exerciseCount: 1, tonnageKg: 1450 - index * 20 }
}));
const weeks = Array.from({ length: 12 }, (_, index) => ({ weekStart: monday(index), sets: { chest: 8 + (index % 4), triceps: 5, shoulders: 6 + (index % 3), lats: 4 }, totalSets: 23 + (index % 5) })); // newest first, like the API
const history = { windowSessions: 8, bestE1rmKg: 92, recentSessions: Array.from({ length: 8 }, (_, index) => ({ eventId: String(index), date: day(index * 7).toISOString().slice(0, 10), topWeightKg: 80 - index, totalReps: 24, bestE1rmKg: 100 - index * 2 })) };

function respond(url: string, scenario: Scenario): Promise<Response> {
  if (scenario === "loading") return new Promise(() => undefined);
  if (scenario === "error") return Promise.resolve(Response.json({ error: "boom" }, { status: 500 }));
  const empty = scenario === "empty";
  const json = (body: unknown) => Promise.resolve(Response.json(body));
  if (url.includes("/api/workouts/volume")) return json({ weeks: empty ? [] : weeks });
  if (url.includes("/api/workouts")) return json({ sessions: empty ? [] : sessions });
  if (url.includes("/history")) return json(history);
  if (url.includes("/api/templates")) return json({ items: empty ? [] : [{ id: "t1", name: "Push day", exercises: [{ exerciseId: benchId, sets: 3 }], isArchived: false, createdAt: "", updatedAt: "" }] });
  return Promise.resolve(Response.json({}, { status: 404 }));
}

/** Serves the Studio REST endpoints from fixtures for one scenario, restoring fetch when the story unmounts. */
const withApi = (scenario: Scenario): Decorator => function StudioApi(Story) {
  const [client] = useState(() => {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL) => respond(String(input instanceof Request ? input.url : input), scenario)) as typeof fetch;
    void original;
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
  title: "Studio/Dashboard",
  component: Dashboard,
  args: { locale: "ru" },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } }
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { decorators: [withApi("populated")] };
export const PopulatedEnglish: Story = { args: { locale: "en" }, decorators: [withApi("populated")] };
export const Empty: Story = { decorators: [withApi("empty")] };
export const Loading: Story = { decorators: [withApi("loading")] };
export const LoadError: Story = { decorators: [withApi("error")] };
