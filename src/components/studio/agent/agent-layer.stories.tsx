import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { getStudioCopy } from "@/i18n/studio-messages";
import { AgentLayer } from "./agent-layer";
import { agentStore } from "./agent-store";

const meta = {
  title: "Studio/Agent layer",
  parameters: { layout: "fullscreen" }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ locale = "ru", actions = [] as Array<[string, string?]>, confirm }: { locale?: "ru" | "en" | "cs"; actions?: Array<[string, string?]>; confirm?: { message: string; rememberable: boolean } }) {
  const copy = getStudioCopy(locale);
  useEffect(() => {
    for (const [tool, detail] of [...actions].reverse()) agentStore.record(tool, detail);
    if (confirm) void agentStore.requestConfirm(confirm.message, { rememberable: confirm.rememberable });
    return () => agentStore.answerConfirm(false);
  }, [actions, confirm]);
  return (
    <MotionConfig reducedMotion="never">
      <div data-surface="studio" className="relative h-[560px] p-8">
        <p className="s-serif text-3xl">Push day</p>
        <AgentLayer copy={copy} />
      </div>
    </MotionConfig>
  );
}

const actions: Array<[string, string?]> = [
  ["builder_save", "Push day"],
  ["builder_link_superset", "Incline Press + Pushdown"],
  ["builder_update_exercise", "Barbell Bench Press"],
  ["builder_add_exercise", "Barbell Bench Press"],
  ["builder_set_name", "Push day"]
];

export const ChipWithHistory: Story = { render: () => <Frame actions={actions} /> };
export const ApprovalToSave: Story = { render: () => <Frame confirm={{ message: copyFor("ru").saveConfirm.replace("{name}", "Push day"), rememberable: true }} /> };
export const ApprovalForDestructiveAction: Story = { render: () => <Frame locale="en" confirm={{ message: getStudioCopy("en").agent.actionConfirm.replace("{action}", "Delete a workout template"), rememberable: false }} /> };
export const Czech: Story = { render: () => <Frame locale="cs" actions={actions.slice(0, 3)} /> };

function copyFor(locale: "ru" | "en" | "cs") {
  return getStudioCopy(locale).agent;
}
