import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { seedEvents } from "@/data/seed";
import type { TimelineEvent } from "@/domain/events";
import { getMessages } from "@/i18n/messages";
import { TodayScreen } from "./today-screen";

const meta = {
  title: "Screens/Today",
  component: TodayScreen,
  parameters: { nextjs: { appDirectory: true } },
  args: {
    locale: "ru",
    copy: getMessages("ru"),
    initialEvents: seedEvents
  }
} satisfies Meta<typeof TodayScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { initialEvents: [] } };
export const NoPhoto: Story = {
  args: {
    initialEvents: seedEvents.filter((event) => event.type !== "progress_photo")
  }
};
export const CompletedActions: Story = {
  args: {
    initialEvents: [
      ...seedEvents,
      {
        id: "49233c1c-bfc3-4739-842d-7c1e1b9f9b50",
        type: "progress_photo",
        occurredAt: new Date(),
        timezone: "Europe/Prague",
        photos: [
          { id: "today-front", url: "/demo/progress-front.png", alt: "Today front progress view" },
          { id: "today-side", url: "/demo/progress-side.png", alt: "Today side progress view" }
        ]
      },
      {
        id: "0e631e51-b1ec-4349-8f80-c8a3bc675e81",
        type: "measurements",
        occurredAt: new Date(),
        timezone: "Europe/Prague",
        values: { weightKg: 84.7, waistCm: 73 }
      }
    ] satisfies TimelineEvent[]
  }
};
export const English: Story = { args: { locale: "en", copy: getMessages("en") } };
export const Czech: Story = { args: { locale: "cs", copy: getMessages("cs") } };

export const NarrowRefreshSafeAreaScroll: Story = {
  name: "Narrow refresh safe-area scroll",
  beforeEach: () => {
    window.scrollTo(0, 0);

    return () => window.scrollTo(0, 0);
  },
  play: async () => {
    await waitFor(() => expect(Math.round(window.scrollY)).toBe(59));
  },
  parameters: {
    viewport: {
      value: "iphone",
      isRotated: false
    },
    docs: {
      description: {
        story: "Reproduces refreshing the Today screen while Storybook is already in a narrow mobile viewport. The screen must start scrolled down by the iPhone 15 Pro safe-area height."
      }
    }
  }
};
