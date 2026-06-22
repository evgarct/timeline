"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Settings } from "lucide-react";
import Link from "next/link";
import type { EventType, TimelineEvent } from "@/domain/events";
import { groupEventsByDay, isFresh, isScheduleDue, isTaskCompleted, latestEvent } from "@/domain/timeline";
import { seedSchedules } from "@/data/seed";
import type { Copy } from "@/i18n/messages";
import { Button } from "@/components/ui/button";
import { LanguageMenu } from "./language-menu";
import { MediaStrip } from "./media-strip";
import { Section } from "./section";
import { TaskRow } from "./task-row";
import { TimelineRow } from "./timeline-row";
import { EventComposer } from "./event-composer";

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
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(value);
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
  const dueSchedules = seedSchedules.filter((schedule) => isScheduleDue(schedule));
  const grouped = useMemo(() => groupEventsByDay(events), [events]);
  const latestPhoto = latestEvent(events, "progress_photo");
  const latestMeasurements = latestEvent(events, "measurements");
  const latestInBody = latestEvent(events, "inbody");

  function markSaved(type: EventType) {
    const placeholder: TimelineEvent =
      type === "workout"
        ? { id: crypto.randomUUID(), type, occurredAt: new Date(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, completed: true, muscleGroups: ["Push"] }
        : type === "measurements"
          ? { id: crypto.randomUUID(), type, occurredAt: new Date(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, values: { weightKg: 85 } }
          : type === "progress_photo"
            ? { id: crypto.randomUUID(), type, occurredAt: new Date(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, photos: initialEvents.find((event) => event.type === "progress_photo")?.photos ?? [] }
            : { id: crypto.randomUUID(), type, occurredAt: new Date(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, source: { url: "private://pending", mimeType: "image/jpeg", fileName: "InBody.jpg" }, extraction: { method: "local_ocr", reviewed: true }, metrics: [{ key: "weight", label: "Weight", value: 85, unit: "kg", category: "composition" }] };
    setEvents((current) => [placeholder, ...current]);
  }

  return (
    <main className="app-shell px-4 pb-16">
      <header className="sticky top-0 z-20 -mx-4 flex min-h-16 items-center justify-between bg-background/88 px-4 backdrop-blur-xl">
        <button type="button" className="flex items-center gap-1 text-base font-semibold">
          {copy.today}
          <ChevronDown aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1">
          <LanguageMenu locale={locale} />
          <Button asChild variant="ghost" size="icon">
            <Link href={`/${locale}/settings`} aria-label={copy.settings}><Settings /></Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-8 pt-3">
        <Section title={copy.tasks}>
          <div className="surface divide-y overflow-hidden rounded-xl">
            {dueSchedules.map((schedule) => (
              <TaskRow
                key={schedule.id}
                type={schedule.eventType}
                title={copy[titleKeys[schedule.eventType]]}
                detail={schedule.intervalWeeks === 1 ? copy.weekly : `Every ${schedule.intervalWeeks} weeks`}
                completed={isTaskCompleted(schedule.eventType, events)}
                onSelect={setComposer}
              />
            ))}
          </div>
        </Section>

        <Section title={copy.current}>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setComposer("progress_photo")}
              className="surface col-span-2 overflow-hidden rounded-xl p-2 text-left"
            >
              {latestPhoto?.type === "progress_photo" && isFresh(latestPhoto) ? (
                <>
                  <MediaStrip photos={latestPhoto.photos} priority />
                  <span className="mt-2 flex items-center justify-between px-1 text-xs">
                    <strong>{copy.progressPhoto}</strong>
                    <span className="text-muted-foreground">5 days ago</span>
                  </span>
                </>
              ) : <span className="block p-5 text-sm text-muted-foreground">{copy.stale}</span>}
            </button>
            <button type="button" onClick={() => setComposer("measurements")} className="surface min-h-24 rounded-xl p-3 text-left">
              <span className="text-xs font-medium">{copy.measurements}</span>
              <span className="mt-3 block text-xl font-semibold">
                {latestMeasurements?.type === "measurements" && isFresh(latestMeasurements) ? `${latestMeasurements.values.weightKg ?? "—"} kg` : "—"}
              </span>
            </button>
            <button type="button" onClick={() => setComposer("inbody")} className="surface min-h-24 rounded-xl p-3 text-left">
              <span className="text-xs font-medium">{copy.inbody}</span>
              <span className="mt-3 block text-xl font-semibold">
                {latestInBody?.type === "inbody" && isFresh(latestInBody)
                  ? `${latestInBody.metrics.find((metric) => metric.key === "percent_body_fat")?.value ?? "—"}%`
                  : "—"}
              </span>
            </button>
          </div>
        </Section>

        <Section title={copy.recent}>
          <div className="flex flex-col gap-2">
            {events.slice(0, 3).map((event) => (
              <TimelineRow key={event.id} event={event} copy={copy} locale={locale} rail={false} />
            ))}
          </div>
        </Section>

        <div className="flex justify-center py-2">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <a href="#timeline" aria-label={copy.timeline}><ChevronDown /></a>
          </Button>
        </div>

        <Section
          id="timeline"
          title={copy.timeline}
          action={
            <Button variant="ghost" size="sm" onClick={() => setComposer("workout")}>
              <Plus data-icon="inline-start" />
              {copy.addEvent}
            </Button>
          }
        >
          <div className="timeline-rail flex flex-col gap-6">
            {Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day} className="flex flex-col gap-3">
                <h3 className="pl-8 text-xs font-semibold capitalize">{dayLabel(day, locale)}</h3>
                {dayEvents.map((event) => (
                  <TimelineRow key={event.id} event={event} copy={copy} locale={locale} />
                ))}
              </div>
            ))}
          </div>
        </Section>
      </div>

      <EventComposer type={composer} copy={copy} onClose={() => setComposer(null)} onSaved={markSaved} />
    </main>
  );
}
