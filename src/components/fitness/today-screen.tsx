"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Info, MoreHorizontal, Plus, Settings } from "lucide-react";
import Link from "next/link";
import type { EventType, ProgressPhoto, TimelineEvent } from "@/domain/events";
import { groupEventsByDay, isTaskCompleted, latestEvent } from "@/domain/timeline";
import { seedSchedules } from "@/data/seed";
import type { Copy } from "@/i18n/messages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EventComposer } from "./event-composer";
import { EventIcon } from "./icon";
import { LanguageMenu } from "./language-menu";
import { TimelineRow } from "./timeline-row";

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

function dateParts(value: Date, locale: string) {
  return {
    title: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(value),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(value),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(value)
  };
}

function relativeDays(value: Date, locale: string) {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startValue = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const days = Math.round((startValue.getTime() - startToday.getTime()) / 86_400_000);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}

function metricValue(event: TimelineEvent | undefined, key: string) {
  if (event?.type !== "inbody") return undefined;
  return event.metrics.find((metric) => metric.key === key);
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
  const [photoIndex, setPhotoIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [photoDirection, setPhotoDirection] = useState<"next" | "prev">("next");
  const pointerStart = useRef<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<{ destroy: () => void; loadAndOpen: (index: number) => void } | null>(null);

  const primaryActionTypes: EventType[] = ["workout", "progress_photo", "measurements"];
  const todaySchedules = seedSchedules.filter((schedule) => primaryActionTypes.includes(schedule.eventType));
  const grouped = useMemo(() => groupEventsByDay(events), [events]);
  const latestPhoto = latestEvent(events, "progress_photo");
  const latestMeasurements = latestEvent(events, "measurements");
  const latestInBody = latestEvent(events, "inbody");
  const visiblePhotos = latestPhoto?.type === "progress_photo" ? latestPhoto.photos.filter((photo) => photo.url) : [];
  const safePhotoIndex = visiblePhotos.length ? Math.min(photoIndex, visiblePhotos.length - 1) : 0;
  const selectedPhoto = visiblePhotos[safePhotoIndex] ?? visiblePhotos[0];
  const selectedPalette = selectedPhoto?.palette;
  const photoDate = latestPhoto?.occurredAt ?? new Date();
  const photoContext = dateParts(photoDate, locale);
  const bodyFat = metricValue(latestInBody, "percent_body_fat");
  const wallpaperStyle = {
    "--wallpaper-background": selectedPalette?.background ?? "var(--background)",
    "--wallpaper-accent": selectedPalette?.accent ?? "color-mix(in oklab, var(--accent) 70%, white)",
    "--wallpaper-foreground": selectedPalette?.foreground ?? "var(--foreground)"
  } as CSSProperties;

  useEffect(() => {
    if (!galleryRef.current || visiblePhotos.length === 0) return;
    let mounted = true;
    void import("photoswipe/lightbox").then(({ default: PhotoSwipeLightbox }) => {
      if (!mounted || !galleryRef.current) return;
      const lightbox = new PhotoSwipeLightbox({
        gallery: galleryRef.current,
        children: "a",
        pswpModule: () => import("photoswipe"),
        bgOpacity: 0.96,
        pinchToClose: true,
        closeOnVerticalDrag: true,
        showHideAnimationType: "fade"
      });
      lightbox.init();
      lightboxRef.current = lightbox;
    });
    return () => {
      mounted = false;
      lightboxRef.current?.destroy();
      lightboxRef.current = null;
    };
  }, [visiblePhotos.length]);

  function markSaved(event: TimelineEvent) {
    setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
    if (event.type === "progress_photo") setPhotoIndex(0);
  }

  function changePhoto(direction: "next" | "prev") {
    if (visiblePhotos.length < 2) return;
    setPhotoDirection(direction);
    setPhotoIndex((current) => {
      if (direction === "next") return (current + 1) % visiblePhotos.length;
      return (current - 1 + visiblePhotos.length) % visiblePhotos.length;
    });
  }

  function handlePointerUp(clientX: number) {
    if (pointerStart.current === null) return;
    const distance = clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) < 44) {
      lightboxRef.current?.loadAndOpen(safePhotoIndex);
      return;
    }
    changePhoto(distance < 0 ? "next" : "prev");
  }

  return (
    <main className="app-shell today-shell relative min-h-screen overflow-x-hidden bg-background" style={wallpaperStyle}>
      <section className="relative h-[100dvh] overflow-hidden bg-[var(--wallpaper-background)] text-white">
        {selectedPhoto?.url ? (
          <>
            <div className="absolute inset-0 overflow-hidden">
              {/* Private signed URLs expire, so native images are used instead of Next's persistent optimizer cache. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.thumbnailUrl ?? selectedPhoto.url}
                alt=""
                className="size-full scale-110 object-cover opacity-55 blur-2xl"
                loading="eager"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
            <button
              type="button"
              data-testid="today-photo-surface"
              aria-label={copy.openPhoto}
              className="absolute inset-0 cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              onPointerDown={(event) => {
                pointerStart.current = event.clientX;
              }}
              onPointerCancel={() => {
                pointerStart.current = null;
              }}
              onPointerUp={(event) => handlePointerUp(event.clientX)}
              onMouseDown={(event) => {
                pointerStart.current ??= event.clientX;
              }}
              onMouseUp={(event) => handlePointerUp(event.clientX)}
              onTouchStart={(event) => {
                pointerStart.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const clientX = event.changedTouches[0]?.clientX;
                if (clientX !== undefined) handlePointerUp(clientX);
              }}
            >
              <span
                key={selectedPhoto.id}
                className={cn(
                  "block h-full opacity-0 will-change-transform motion-safe:animate-[photo-arrive_780ms_ease-out_forwards]",
                  photoDirection === "next" ? "motion-safe:[--photo-enter-x:14px]" : "motion-safe:[--photo-enter-x:-14px]"
                )}
              >
                <span className="block h-full motion-safe:animate-[photo-breathe_18s_ease-in-out_900ms_infinite_alternate]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPhoto.url}
                    alt={selectedPhoto.alt}
                    className="mx-auto h-full w-full object-contain px-2 pb-[15rem] pt-[calc(var(--safe-top)+4.75rem)]"
                    loading="eager"
                    fetchPriority="high"
                  />
                </span>
              </span>
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-10 text-center text-foreground">
            <EventIcon type="progress_photo" />
            <h1 className="text-2xl font-semibold">{copy.noPhotoTitle}</h1>
            <p className="text-sm text-muted-foreground">{copy.noPhotoBody}</p>
            <Button size="lg" onClick={() => setComposer("progress_photo")}>
              <Plus data-icon="inline-start" />
              {copy.progressPhoto}
            </Button>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/48%),transparent_24%,transparent_58%,rgb(0_0_0/28%)_100%)]" />

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-[calc(var(--safe-top)+2.75rem)]">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="max-w-[70%] text-left text-white drop-shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? copy.hideBodyData : copy.bodyData}
          >
            <span className="block text-3xl font-semibold leading-none tracking-normal">{copy.today}</span>
            <span className="mt-2 block text-xl text-white/78">{photoContext.title}</span>
            <span className="mt-3 block text-sm capitalize text-white/70">{copy.morning}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={copy.openMenu} className="rounded-full bg-black/18 text-white ring-1 ring-white/30 backdrop-blur-xl hover:bg-black/28 hover:text-white">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover/92 backdrop-blur-xl">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}`}>{copy.home}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/settings`}>
                    <Settings />
                    {copy.settings}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="absolute bottom-[14.25rem] left-5 z-20 flex flex-col gap-1 text-sm text-white/82 drop-shadow-sm">
          <span>{photoContext.time}</span>
          <span>{copy.beforeWorkout}</span>
          <span className="text-white/62">{copy.atHome}</span>
        </div>

        {visiblePhotos.length > 1 ? (
          <div className="absolute inset-x-0 bottom-[16.75rem] z-40 flex justify-center gap-1.5" aria-label={copy.swipePhoto}>
            {visiblePhotos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`${copy.swipePhoto} ${index + 1}`}
                onClick={() => {
                  setPhotoDirection(index > safePhotoIndex ? "next" : "prev");
                  setPhotoIndex(index);
                }}
                className={cn("h-1.5 rounded-full transition-all", index === safePhotoIndex ? "w-7 bg-white" : "w-1.5 bg-white/45")}
              />
            ))}
          </div>
        ) : null}

        <div className="absolute inset-x-3 bottom-[calc(var(--safe-bottom)+1rem)] z-30 mx-auto max-w-lg rounded-[2rem] border border-white/42 bg-white/82 p-2.5 text-foreground shadow-[0_24px_80px_rgb(0_0_0/22%)] backdrop-blur-2xl">
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-foreground/18" />
          <div className="flex flex-col gap-2">
            {todaySchedules.map((schedule) => (
              <button
                key={schedule.id}
                type="button"
                onClick={() => setComposer(schedule.eventType)}
                className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[1.35rem] bg-white/58 px-3 py-2 text-left shadow-[0_10px_30px_rgb(0_0_0/5%)] transition-colors hover:bg-white/74 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <EventIcon type={schedule.eventType} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{copy[titleKeys[schedule.eventType]]}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {isTaskCompleted(schedule.eventType, events) ? copy.completed : copy.notCompleted}
                  </span>
                </span>
                <span className="flex size-6 items-center justify-center rounded-full border border-foreground/18 text-foreground/65" aria-label={isTaskCompleted(schedule.eventType, events) ? copy.completed : copy.notCompleted}>
                  {isTaskCompleted(schedule.eventType, events) ? <Check aria-hidden="true" /> : null}
                </span>
              </button>
            ))}
          </div>
          <div className={cn("grid transition-all duration-500 ease-out", detailsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="min-h-0 overflow-hidden">
              {detailsOpen ? (
              <div className="mt-3 rounded-[1.35rem] bg-white/48 p-4" data-testid="body-data-panel">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{copy.bodyData}</span>
                  <Info aria-hidden="true" className="text-muted-foreground" />
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{copy.weight}</dt>
                    <dd className="font-semibold">{latestMeasurements?.type === "measurements" && latestMeasurements.values.weightKg ? `${latestMeasurements.values.weightKg} kg` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{copy.waist}</dt>
                    <dd className="font-semibold">{latestMeasurements?.type === "measurements" && latestMeasurements.values.waistCm ? `${latestMeasurements.values.waistCm} cm` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{copy.bodyFat}</dt>
                    <dd className="font-semibold">{bodyFat ? `${bodyFat.value}${bodyFat.unit ?? ""}` : "—"}</dd>
                  </div>
                </dl>
                {latestPhoto?.type === "progress_photo" && latestPhoto.note ? (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">{copy.photoNote}: </span>
                    {latestPhoto.note}
                  </p>
                ) : null}
              </div>
              ) : null}
            </div>
          </div>
          <a href="#timeline" aria-label={copy.scrollTimeline} className="mt-2 flex justify-center rounded-full py-1 text-foreground/45 transition-colors hover:text-foreground">
            <ChevronDown aria-hidden="true" />
          </a>
        </div>

        <div ref={galleryRef} className="hidden">
          {visiblePhotos.map((photo: ProgressPhoto) => (
            <a
              key={photo.id}
              href={photo.url}
              data-pswp-width={photo.width ?? 3000}
              data-pswp-height={photo.height ?? 4000}
              aria-label={`${copy.openGallery}: ${photo.alt}`}
            />
          ))}
        </div>
      </section>

      <section id="timeline" className="relative z-10 -mt-1 min-h-screen rounded-t-[2rem] bg-background px-4 pb-16 pt-8">
        <div className="mx-auto flex max-w-lg flex-col gap-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{relativeDays(photoDate, locale)}</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-normal">{copy.timeline}</h2>
            </div>
            <LanguageMenu locale={locale} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setComposer("progress_photo")} className="justify-start rounded-2xl bg-card/84">
              <Plus data-icon="inline-start" />
              {copy.addPhoto}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setComposer("workout")} className="justify-start rounded-2xl bg-card/84">
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
