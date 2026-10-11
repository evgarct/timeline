import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { getStudioCopy } from "@/i18n/studio-messages";
import type { FeedbackEntry } from "@/lib/studio/types";
import { FeedbackView, type FeedbackViewProps } from "./feedback-inbox";

const entry = (id: string, extra: Partial<FeedbackEntry>): FeedbackEntry => ({
  id, category: "friction", summary: "list_events cannot filter by muscle", source: "mcp", status: "new",
  createdAt: "2026-10-10T09:30:00.000Z", updatedAt: "2026-10-10T09:30:00.000Z", ...extra
});

const entries: FeedbackEntry[] = [
  entry("1", { category: "bug", severity: "high", tool: "update_workout_session", summary: "update_workout_session dropped my superset groups", details: "I corrected one weight and the groupId values were gone afterwards.", expected: "Untouched sets keep their groupId.", suggestion: "Return every set field from get_workout_session so a replace is lossless.", toolCalls: [{ tool: "get_workout_session", outcome: "confusing", note: "no groupId in the text" }, { tool: "update_workout_session", outcome: "ok" }], client: "Claude Code", source: "mcp" }),
  entry("2", { category: "works_well", tool: "preview_template_volume", summary: "preview_template_volume made balancing the plan easy", suggestion: "Keep it read-only and fast.", source: "webmcp", page: "/ru/studio/templates/new", status: "triaged", resolution: "Keep as is." }),
  entry("3", { category: "missing_tool", summary: "No way to list exercises I used most", severity: "low", status: "done", resolution: "Added to the dashboard (PR #99)." })
];

const meta = {
  title: "Studio/Feedback inbox",
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => (
    <MotionConfig reducedMotion="never"><div data-surface="studio" className="min-h-screen"><Story /></div></MotionConfig>
  )]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness(props: Partial<FeedbackViewProps> & { locale?: "ru" | "en" | "cs" }) {
  const locale = props.locale ?? "ru";
  const [filter, setFilter] = useState<FeedbackViewProps["filter"]>({});
  const visible = (props.entries ?? entries).filter((item) => (!filter.status || item.status === filter.status) && (!filter.category || item.category === filter.category));
  return (
    <FeedbackView
      copy={getStudioCopy(locale)}
      locale={locale}
      state={props.state ?? "ready"}
      entries={visible}
      filter={filter}
      onFilter={setFilter}
      onUpdate={() => undefined}
      onRetry={() => undefined}
    />
  );
}

export const Populated: Story = { render: () => <Harness /> };
export const English: Story = { render: () => <Harness locale="en" /> };
export const Czech: Story = { render: () => <Harness locale="cs" /> };
export const Empty: Story = { render: () => <Harness entries={[]} /> };
export const Loading: Story = { render: () => <Harness state="loading" /> };
export const LoadError: Story = { render: () => <Harness state="error" /> };
