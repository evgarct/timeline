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
      className="group flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[1.1rem] px-3 py-1.5 text-left transition-colors hover:bg-white/34 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black/[0.045] text-foreground/76 [&_svg]:size-3">
        {actionIcon(type)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.82rem] font-medium leading-tight">{title}</span>
        <span className="mt-0.5 block truncate text-[0.62rem] leading-tight text-muted-foreground">
          {completed ? copy.completed : copy.notCompleted}
        </span>
      </span>
      <span
        className="flex size-[0.95rem] shrink-0 items-center justify-center rounded-full border border-foreground/20 text-foreground/62 transition-colors group-hover:border-foreground/28 [&_svg]:size-2.5"
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

  function markSaved(event: TimelineEvent) {
    setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
  }

  return (
    <main className="app-shell today-shell relative min-h-screen overflow-x-hidden bg-background" style={heroStyle}>
      <section className="relative h-[100svh] min-h-[42rem] overflow-hidden bg-[var(--today-photo-bg)] text-white">
        {heroPhoto?.url ? (
          <>
            <div className="absolute inset-0 overflow-hidden">
              {/* Private signed URLs expire, so native images are used instead of Next's persistent optimizer cache. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhoto.thumbnailUrl ?? heroPhoto.url}
                alt=""
                className="size-full scale-110 object-cover opacity-65 blur-2xl"
                loading="eager"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-black/28" />
            </div>

            <a
              href={heroPhoto.url}
              data-testid="today-photo-surface"
              aria-label={copy.openPhoto}
              className="absolute inset-0 cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <span className="block h-full motion-safe:animate-[photo-breathe_20s_ease-in-out_900ms_infinite_alternate]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroPhoto.url}
                  alt={heroPhoto.alt}
                  className="size-full object-cover object-center"
                  loading="eager"
                  fetchPriority="high"
                />
              </span>
            </a>
          </>
        ) : (
          <PhotoFallback copy={copy} onSelect={setComposer} />
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/54%),rgb(0_0_0/18%)_23%,transparent_48%,rgb(0_0_0/18%)_100%)]" />

        <div data-testid="today-title-overlay" className="pointer-events-none absolute inset-x-0 top-0 z-20 px-6 pt-[calc(var(--safe-top)+2.75rem)] text-white drop-shadow-sm">
          <h1 className="text-[2.15rem] font-semibold leading-none tracking-normal">{copy.today}</h1>
          <p className="mt-3 text-[1.28rem] font-normal leading-none text-white/78">{dateLabel(heroDate, locale)}</p>
          <p className="mt-3.5 text-xs font-normal capitalize leading-none text-white/68">{copy.morning}</p>
        </div>

        <div data-testid="today-action-sheet" className="absolute inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-30 mx-auto max-w-lg rounded-[1.8rem] border border-white/44 bg-white/76 px-2 pb-2 pt-1.5 text-foreground shadow-[0_20px_64px_rgb(0_0_0/20%)] backdrop-blur-2xl">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-foreground/18" />
          <div className="flex flex-col">
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
          <a href="#timeline" aria-label={copy.scrollTimeline} className="mt-0.5 flex justify-center rounded-full py-0.5 text-foreground/38 transition-colors hover:text-foreground/64">
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
