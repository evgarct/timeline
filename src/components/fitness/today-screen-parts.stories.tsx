import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CSSProperties } from "react";
import { seedEvents } from "@/data/seed";
import type { TimelineEvent } from "@/domain/events";
import { latestEvent } from "@/domain/timeline";
import { getMessages } from "@/i18n/messages";
import { TodayActionDrawer, TodayHero, TodayTimelineSection, groupTodayEvents } from "./today-screen-parts";

const copy = getMessages("ru");
const latestPhoto = latestEvent(seedEvents, "progress_photo");
const heroPhoto = latestPhoto?.type === "progress_photo" ? latestPhoto.photos.find((photo) => photo.url) : undefined;
const heroStyle = {
  "--today-photo-bg": heroPhoto?.palette?.background ?? "oklch(0.23 0.01 70)",
  "--today-photo-accent": heroPhoto?.palette?.accent ?? "oklch(0.9 0.01 70)"
} as CSSProperties;

const meta = {
  title: "Screens/Today/Components",
  parameters: {
    nextjs: { appDirectory: true },
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hero: Story = {
  render: () => (
    <main className="app-shell today-shell bg-background" style={heroStyle}>
      <TodayHero
        locale="ru"
        copy={copy}
        heroDate={latestPhoto?.occurredAt ?? new Date()}
        heroPhotoUrl={heroPhoto?.url}
        heroThumbnailUrl={heroPhoto?.thumbnailUrl ?? heroPhoto?.url}
        onSelect={() => undefined}
      />
    </main>
  )
};

export const HeroEmpty: Story = {
  render: () => (
    <main className="app-shell today-shell bg-background" style={heroStyle}>
      <TodayHero locale="ru" copy={copy} heroDate={new Date()} onSelect={() => undefined} />
    </main>
  )
};

export const ActionDrawer: Story = {
  render: () => (
    <main className="app-shell today-shell min-h-[420px] bg-[var(--today-photo-bg)] text-foreground" style={heroStyle}>
      <div className="relative min-h-[420px] overflow-hidden">
        <TodayActionDrawer copy={copy} events={seedEvents} onSelect={() => undefined} />
      </div>
    </main>
  )
};

export const ActionDrawerCompleted: Story = {
  render: () => {
    const completedEvents = [
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
    ] satisfies TimelineEvent[];

    return (
      <main className="app-shell today-shell min-h-[420px] bg-[var(--today-photo-bg)] text-foreground" style={heroStyle}>
        <div className="relative min-h-[420px] overflow-hidden">
          <TodayActionDrawer copy={copy} events={completedEvents} onSelect={() => undefined} />
        </div>
      </main>
    );
  }
};

export const TimelineContent: Story = {
  render: () => (
    <main className="app-shell today-shell bg-background">
      <TodayTimelineSection
        locale="ru"
        copy={copy}
        grouped={groupTodayEvents(seedEvents)}
        onSelect={() => undefined}
        languageMenu={<span className="text-sm text-muted-foreground">RU</span>}
      />
    </main>
  )
};
