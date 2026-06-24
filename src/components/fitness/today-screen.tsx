"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { Camera, Check, ChevronDown, Dumbbell, Plus, Ruler } from "lucide-react";
import type { EventType, TimelineEvent } from "@/domain/events";
import { groupEventsByDay, isTaskCompleted, latestEvent } from "@/domain/timeline";
import type { Copy } from "@/i18n/messages";
import { Button } from "@/components/ui/button";
import { EventComposer } from "./event-composer";
import { LanguageMenu } from "./language-menu";
import { TimelineRow } from "./timeline-row";

const actionTypes: EventType[] = ["workout", "measurements", "progress_photo"];

const titleKeys: Record<EventType, keyof Pick<Copy, "workout" | "measurements" | "progressPhoto" | "inbody">> = {
  workout: "workout",
  measurements: "measurements",
  progress_photo: "progressPhoto",
  inbody: "inbody"
};

function dayLabel(day: string, locale: string) {
  const value = new Date(`${day}T12:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === today.toDateString()) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "day");
  if (value.toDateString() === yesterday.toDateString()) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(value);
}

function dateLabel(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(value);
}

function actionIcon(type: EventType) {
  if (type === "workout") return <Dumbbell aria-hidden="true" />;
  if (type === "measurements") return <Ruler aria-hidden="true" />;
  return <Camera aria-hidden="true" />;
}

function TodayAction({
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
    <button
      type="button"
      onClick={() => onSelect(type)}
      data-testid={`today-action-${type}`}
      className="group flex h-[72px] w-full cursor-pointer items-center gap-4 rounded-[1.35rem] px-0 text-left transition-colors hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/[0.045] text-foreground/48 [&_svg]:size-[22px]">
        {actionIcon(type)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[18px] font-semibold leading-[22px] text-foreground">{title}</span>
        <span className="mt-1 block truncate text-[15px] font-normal leading-[18px] text-foreground/55">
          {completed ? copy.completed : copy.notCompleted}
        </span>
      </span>
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground/16 text-foreground/42 transition-colors group-hover:border-foreground/24 [&_svg]:size-3.5"
        aria-label={completed ? copy.completed : copy.notCompleted}
      >
        {completed ? <Check aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

function PhotoFallback({ copy, onSelect }: { copy: Copy; onSelect: (type: EventType) => void }) {
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

export function TodayScreen({
  locale,
  copy,
  initialEvents
}: {
  locale: string;
  copy: Copy;
  initialEvents: TimelineEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [composer, setComposer] = useState<EventType | null>(null);
  const grouped = useMemo(() => groupEventsByDay(events), [events]);
  const latestPhoto = latestEvent(events, "progress_photo");
  const visiblePhotos = latestPhoto?.type === "progress_photo" ? latestPhoto.photos.filter((photo) => photo.url) : [];
  const heroPhoto = visiblePhotos[0];
  const heroDate = latestPhoto?.occurredAt ?? new Date();
  const palette = heroPhoto?.palette;
  const heroStyle = {
    "--today-photo-bg": palette?.background ?? "oklch(0.23 0.01 70)",
    "--today-photo-accent": palette?.accent ?? "oklch(0.9 0.01 70)"
  } as CSSProperties;
  const heroPhotoStyle = heroPhoto?.url
    ? { backgroundImage: `url("${heroPhoto.url}")` } as CSSProperties
    : undefined;
  const heroThumbnailStyle = heroPhoto?.thumbnailUrl || heroPhoto?.url
    ? { backgroundImage: `url("${heroPhoto.thumbnailUrl ?? heroPhoto?.url}")` } as CSSProperties
    : undefined;

  function markSaved(event: TimelineEvent) {
    setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
  }

  return (
    <main className="app-shell today-shell relative min-h-screen overflow-x-hidden bg-background" style={heroStyle}>
      <section className="relative h-[100svh] overflow-hidden bg-[var(--today-photo-bg)] text-white">
        {heroPhoto?.url ? (
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
              href={heroPhoto.url}
              data-testid="today-photo-surface"
              aria-label={copy.openPhoto}
              className="absolute inset-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            />
          </>
        ) : (
          <PhotoFallback copy={copy} onSelect={setComposer} />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(to_bottom,rgb(0_0_0/46%),rgb(0_0_0/22%)_48%,transparent_100%)]" />

        <div data-testid="today-title-overlay" className="pointer-events-none absolute inset-x-0 top-0 z-20 px-6 pt-[calc(var(--safe-top)+20px)] text-white drop-shadow-sm">
          <h1 className="text-[43px] font-bold leading-[47px] tracking-normal">{copy.today}</h1>
          <p className="mt-3 text-[24px] font-medium leading-[28px] text-white/80">{dateLabel(heroDate, locale)}</p>
          <p className="mt-4 text-[17px] font-normal capitalize leading-[21px] text-white/65">{copy.morning}</p>
        </div>

        <div data-testid="today-action-sheet" className="absolute inset-x-0 bottom-0 z-30 h-[calc(286px+var(--safe-bottom))] rounded-t-[36px] border border-white/24 bg-white/72 px-6 pb-[var(--safe-bottom)] pt-4 text-foreground shadow-[0_-8px_36px_rgb(0_0_0/8%)] backdrop-blur-[34px]">
          <div className="mx-auto mb-[17px] h-[5px] w-12 rounded-full bg-[#C8C8C8]" />
          <div className="flex flex-col gap-4">
            {actionTypes.map((type) => (
              <TodayAction
                key={type}
                type={type}
                title={copy[titleKeys[type]]}
                completed={isTaskCompleted(type, events)}
                copy={copy}
                onSelect={setComposer}
              />
            ))}
          </div>
          <a href="#timeline" aria-label={copy.scrollTimeline} className="sr-only">
            <ChevronDown aria-hidden="true" className="size-4" />
          </a>
        </div>
      </section>

      <section id="timeline" className="relative z-10 -mt-1 min-h-screen rounded-t-[2rem] bg-background px-4 pb-16 pt-8">
        <div className="mx-auto flex max-w-lg flex-col gap-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{copy.bodyHistory}</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-normal">{copy.timeline}</h2>
            </div>
            <LanguageMenu locale={locale} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => setComposer("progress_photo")} className="flex-1 justify-start rounded-2xl bg-card/84">
              <Plus data-icon="inline-start" />
              {copy.addPhoto}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setComposer("workout")} className="flex-1 justify-start rounded-2xl bg-card/84">
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

      <EventComposer type={composer} copy={copy} onClose={() => setComposer(null)} onSaved={markSaved} />
    </main>
  );
}
