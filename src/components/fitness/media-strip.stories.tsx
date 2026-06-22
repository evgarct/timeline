import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { seedEvents } from "@/data/seed";
import { MediaStrip } from "./media-strip";

const photoEvent = seedEvents.find((event) => event.type === "progress_photo");

const meta = {
  title: "Design System/Media Strip",
  component: MediaStrip,
  args: {
    photos: photoEvent?.type === "progress_photo" ? photoEvent.photos : [],
    large: false
  }
} satisfies Meta<typeof MediaStrip>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Compact: Story = {};
export const Large: Story = { args: { large: true } };

