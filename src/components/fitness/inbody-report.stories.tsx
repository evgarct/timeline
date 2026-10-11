import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fabricatedInBodyMetrics } from "@/data/seed-inbody";
import { timelineEventSchema } from "@/domain/events";
import type { InBodyEvent } from "@/domain/inbody";
import { getInBodyCopy } from "@/i18n/inbody-messages";
import { InBodyReport } from "./inbody-report";

const sheet = (scale: 0 | 1, occurredAt: string, extra: Partial<InBodyEvent> = {}) => timelineEventSchema.parse({
  id: scale === 0 ? "0f6f2d4c-0b2a-4b53-9d0e-5c3b1a7e6a10" : "7e5839e1-0274-4969-be96-a96e407fd9bf",
  type: "inbody",
  occurredAt,
  timezone: "Europe/Prague",
  source: { url: "/demo/inbody-sample.jpg", mimeType: "image/jpeg", fileName: "InBody-demo.jpg" },
  report: { device: "InBody270", heightCm: 180, ageYears: 33, gender: "male" },
  extraction: { method: "mcp_agent", reviewed: true },
  metrics: fabricatedInBodyMetrics(scale),
  ...extra
}) as InBodyEvent;

const previous = sheet(0, "2026-03-01T09:00:00.000Z");
const latest = sheet(1, "2026-06-20T14:16:00.000Z");

const meta = {
  title: "Screens/InBody/Report",
  component: InBodyReport,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  decorators: [(Story) => <main className="app-shell px-4 pb-10 pt-6"><Story /></main>]
} satisfies Meta<typeof InBodyReport>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every printed section with normal ranges, the segment grids, impedance and the change since the previous test. */
export const FullSheetWithChanges: Story = { args: { event: latest, previous, copy: getInBodyCopy("ru"), locale: "ru" } };

export const FirstTestNoPrevious: Story = { args: { event: previous, copy: getInBodyCopy("ru"), locale: "ru" } };

/** An agent that sent only a few readings and no ranges: no bars, no segment grids, no empty sections. */
export const PartialNoReferences: Story = {
  args: {
    event: sheet(1, "2026-06-20T14:16:00.000Z", {
      extraction: { method: "manual", reviewed: false },
      report: undefined,
      metrics: [
        { key: "weight", label: "Weight", value: 76.1, unit: "kg", category: "composition" },
        { key: "skeletal_muscle_mass", label: "Skeletal Muscle Mass", value: 38.2, unit: "kg", category: "composition" },
        { key: "percent_body_fat", label: "Percent Body Fat", value: 13.4, unit: "%", category: "obesity" }
      ]
    }),
    copy: getInBodyCopy("ru"),
    locale: "ru"
  }
};

export const English: Story = { args: { event: latest, previous, copy: getInBodyCopy("en"), locale: "en" } };
export const Czech: Story = { args: { event: latest, previous, copy: getInBodyCopy("cs"), locale: "cs" } };
