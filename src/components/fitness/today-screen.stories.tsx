import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { seedEvents } from "@/data/seed";
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
export const English: Story = { args: { locale: "en", copy: getMessages("en") } };
export const Czech: Story = { args: { locale: "cs", copy: getMessages("cs") } };

