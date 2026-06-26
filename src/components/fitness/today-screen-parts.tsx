"use client";

import type { CSSProperties, ReactNode } from "react";
import { Camera, Check, ChevronDown, Dumbbell, Plus, Ruler } from "lucide-react";
import { List } from "antd-mobile/es/components/list/list";
import { ListItem } from "antd-mobile/es/components/list/list-item";
import { SafeArea } from "antd-mobile/es/components/safe-area/safe-area";
import type { EventType, TimelineEvent } from "@/domain/events";
import { groupEventsByDay, isTaskCompleted } from "@/domain/timeline";
import type { Copy } from "@/i18n/messages";
import { Button } from "@/components/ui/button";
import { LanguageMenu } from "./language-menu";
import { TimelineRow } from "./timeline-row";

export const todayActionTypes: EventType[] = ["workout", "measurements", "progress_photo"];

export const titleKeys: Record<EventType, keyof Pick<Copy, "workout" | "measurements" | "progressPhoto" | "inbody">> = {
  workout: "workout",
  measurements: "measurements",
  progress_photo: "progressPhoto",
  inbody: "inbody"
};

export function dateLabel(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(value);
}

export function dayLabel(day: string, locale: string) {
  const value = new Date(`${day}T12:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === today.toDateString()) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "day");
  if (value.toDateString() === yesterday.toDateString()) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  return dateLabel(value, locale);
}

export function actionIcon(type: EventType) {
  if (type === "workout") return <Dumbbell aria-hidden="true" />;
  if (type === "measurements") return <Ruler aria-hidden="true" />;
  return <Camera aria-hidden="true" />;
}

export function TodayActionItem({
  type,
  title,
  completed,
  copy,
  onSelect
}: {
  type: EventType;
  title: string;
  completed: boolean;
  copy: Copy;
  onSelect: (type: EventType) => void;
}) {
  return (
    <ListItem
      clickable
      arrowIcon={false}
      onClick={() => onSelect(type)}
      data-testid={`today-action-${type}`}
      className="today-action-item"
      prefix={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/[0.045] text-foreground/48 [&_svg]:size-[22px]">
          {actionIcon(type)}
        </span>
      }
      description={completed ? copy.completed : copy.notCompleted}
      extra={
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground/16 text-foreground/42 [&_svg]:size-3.5"
          aria-label={completed ? copy.completed : copy.notCompleted}
        >
          {completed ? <Check aria-hidden="true" /> : null}
        </span>
      }
    >
      {title}
    </ListItem>
  );
}

export function TodayPhotoFallback({ copy, onSelect }: { copy: Copy; onSelect: (type: EventType) => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background px-8 text-center text-foreground">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-foreground [&_svg]:size-5">
        <Camera aria-hidden="true" />
      </span>
      <div className="max-w-64">
        <h1 className="text-2xl font-semibold tracking-normal">{copy.noPhotoTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.noPhotoBody}</p>
      </div>
      <Button size="lg" onClick={() => onSelect("progress_photo")}>
        <Plus data-icon="inline-start" />
        {copy.progressPhoto}
      </Button>
    </div>
  );
}

export function TodayHero({
  locale,
  copy,
  heroDate,
  heroPhotoUrl,
  heroThumbnailUrl,
  children,
  onSelect
}: {
  locale: string;
  copy: Copy;
  heroDate: Date;
  heroPhotoUrl?: string;
  heroThumbnailUrl?: string;
  children?: ReactNode;
  onSelect: (type: EventType) => void;
}) {
  const heroPhotoStyle = heroPhotoUrl ? { backgroundImage: `url("${heroPhotoUrl}")` } as CSSProperties : undefined;
  const heroThumbnailStyle = heroThumbnailUrl || heroPhotoUrl
    ? { backgroundImage: `url("${heroThumbnailUrl ?? heroPhotoUrl}")` } as CSSProperties
    : undefined;

  return (
    <section
      data-testid="today-hero"
      className="relative -mt-[var(--safe-top)] h-[calc(100svh+var(--safe-top))] overflow-hidden bg-[var(--today-photo-bg)] text-white"
    >
      {heroPhotoUrl ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-[-5%] bg-cover bg-[position:35%_center] bg-no-repeat opacity-50 blur-2xl"
            style={heroThumbnailStyle}
          />

          <div
            aria-hidden="true"
            data-testid="today-photo-background"
            className="today-photo-motion absolute inset-[-5%] bg-cover bg-[position:35%_center] bg-no-repeat"
            style={heroPhotoStyle}
          />

          <a
            href={heroPhotoUrl}
            data-testid="today-photo-surface"
            aria-label={copy.openPhoto}
            className="absolute inset-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          />
        </>
      ) : (
        <TodayPhotoFallback copy={copy} onSelect={onSelect} />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(to_bottom,rgb(0_0_0/46%),rgb(0_0_0/22%)_48%,transparent_100%)]" />

      <div data-testid="today-title-overlay" className="today-title-overlay pointer-events-none absolute inset-x-0 z-20 px-6 text-white drop-shadow-sm">
        <h1 className="text-[43px] font-bold leading-[47px] tracking-normal">{copy.today}</h1>
        <p className="mt-3 text-[24px] font-medium leading-[28px] text-white/80">{dateLabel(heroDate, locale)}</p>
        <p className="mt-4 text-[17px] font-normal capitalize leading-[21px] text-white/65">{copy.morning}</p>
      </div>
      {children}
    </section>
  );
}

export function TodayActionSheet({
  copy,
  events,
  onSelect
}: {
  copy: Copy;
  events: TimelineEvent[];
  onSelect: (type: EventType) => void;
}) {
  return (
    <div data-testid="today-action-sheet" className="today-action-sheet absolute inset-x-0 bottom-0 z-30 rounded-t-[36px] border border-white/24 bg-white/72 px-6 pt-4 text-foreground shadow-[0_-8px_36px_rgb(0_0_0/8%)] backdrop-blur-[34px]">
      <div className="mx-auto mb-[17px] h-[5px] w-12 rounded-full bg-[#C8C8C8]" />
      <List mode="default" className="today-action-list" style={{ "--border-top": "0", "--border-bottom": "0", "--border-inner": "0" }}>
        {todayActionTypes.map((type) => (
          <TodayActionItem
            key={type}
            type={type}
            title={copy[titleKeys[type]]}
            completed={isTaskCompleted(type, events)}
            copy={copy}
            onSelect={onSelect}
          />
        ))}
      </List>
      <a href="#timeline" aria-label={copy.scrollTimeline} className="sr-only">
        <ChevronDown aria-hidden="true" className="size-4" />
      </a>
      <SafeArea position="bottom" />
    </div>
  );
}

export function TodayTimelineSection({
  locale,
  copy,
  grouped,
  onSelect,
  languageMenu
}: {
  locale: string;
  copy: Copy;
  grouped: Record<string, TimelineEvent[]>;
  onSelect: (type: EventType) => void;
  languageMenu?: ReactNode;
}) {
  return (
    <section id="timeline" className="relative z-10 -mt-1 min-h-screen rounded-t-[2rem] bg-background px-4 pb-16 pt-8">
      <div className="mx-auto flex max-w-lg flex-col gap-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{copy.bodyHistory}</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-normal">{copy.timeline}</h2>
          </div>
          {languageMenu ?? <LanguageMenu locale={locale} />}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={() => onSelect("progress_photo")} className="flex-1 justify-start rounded-2xl bg-card/84">
            <Plus data-icon="inline-start" />
            {copy.addPhoto}
          </Button>
          <Button variant="outline" size="lg" onClick={() => onSelect("workout")} className="flex-1 justify-start rounded-2xl bg-card/84">
            <Check data-icon="inline-start" />
            {copy.markWorkout}
          </Button>
        </div>

        <div className="timeline-rail flex flex-col gap-6">
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day} className="flex flex-col gap-3">
              <h3 className="pl-8 text-xs font-semibold capitalize text-muted-foreground">{dayLabel(day, locale)}</h3>
              {dayEvents.map((event) => (
                <TimelineRow key={event.id} event={event} copy={copy} locale={locale} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function groupTodayEvents(events: TimelineEvent[]) {
  return groupEventsByDay(events);
}
