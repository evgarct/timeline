"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type { EventType, TimelineEvent } from "@/domain/events";
import { latestEvent } from "@/domain/timeline";
import type { Copy } from "@/i18n/messages";
import { EventComposer } from "./event-composer";
import { TodayActionSheet, TodayHero, TodayTimelineSection, groupTodayEvents } from "./today-screen-parts";

const IPHONE_15_PRO_SAFE_AREA_TOP = 59;

function initialSafeAreaScrollOffset() {
  const rootStyle = getComputedStyle(document.documentElement);
  const scrollPaddingTop = Number.parseFloat(rootStyle.scrollPaddingTop);
  if (Number.isFinite(scrollPaddingTop) && scrollPaddingTop > 0) return scrollPaddingTop;

  const safeTop = rootStyle.getPropertyValue("--safe-top");
  const safeTopValues = safeTop.match(/\d+(\.\d+)?px/g)?.map((value) => Number.parseFloat(value)) ?? [];
  return Math.max(IPHONE_15_PRO_SAFE_AREA_TOP, ...safeTopValues);
}

function isStandalonePwa() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function shouldApplyInitialSafeAreaScroll() {
  if (window.location.hash) return false;
  if (Math.abs(window.scrollY) > 1) return false;
  if (!isStandalonePwa()) return false;
  return window.matchMedia("(max-width: 480px) and (orientation: portrait)").matches;
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
  const grouped = useMemo(() => groupTodayEvents(events), [events]);
  const latestPhoto = latestEvent(events, "progress_photo");
  const visiblePhotos = latestPhoto?.type === "progress_photo" ? latestPhoto.photos.filter((photo) => photo.url) : [];
  const heroPhoto = visiblePhotos[0];
  const heroDate = latestPhoto?.occurredAt ?? new Date();
  const palette = heroPhoto?.palette;
  const heroBackground = palette?.background ?? "oklch(0.23 0.01 70)";
  const heroStyle = {
    "--today-photo-bg": heroBackground,
    "--today-photo-accent": palette?.accent ?? "oklch(0.9 0.01 70)"
  } as CSSProperties;

  function markSaved(event: TimelineEvent) {
    setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
  }

  useEffect(() => {
    const root = document.documentElement;
    const previousHtmlBackground = root.style.getPropertyValue("--app-html-background");
    const previousBodyBackground = root.style.getPropertyValue("--app-body-background");
    root.style.setProperty("--app-html-background", heroBackground);
    root.style.setProperty("--app-body-background", heroBackground);

    return () => {
      if (previousHtmlBackground) root.style.setProperty("--app-html-background", previousHtmlBackground);
      else root.style.removeProperty("--app-html-background");
      if (previousBodyBackground) root.style.setProperty("--app-body-background", previousBodyBackground);
      else root.style.removeProperty("--app-body-background");
    };
  }, [heroBackground]);

  useEffect(() => {
    const root = document.documentElement;
    const previousScrollOffset = root.style.getPropertyValue("--today-initial-scroll-offset");
    let appliedScrollOffset = false;
    const frame = window.requestAnimationFrame(() => {
      if (!shouldApplyInitialSafeAreaScroll()) return;
      const offset = initialSafeAreaScrollOffset();
      if (offset <= 0) return;
      root.style.setProperty("--today-initial-scroll-offset", `${offset}px`);
      appliedScrollOffset = true;
      window.scrollTo(0, offset);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (!appliedScrollOffset) return;
      if (previousScrollOffset) root.style.setProperty("--today-initial-scroll-offset", previousScrollOffset);
      else root.style.removeProperty("--today-initial-scroll-offset");
    };
  }, []);

  return (
    <main className="app-shell today-shell relative min-h-screen overflow-x-hidden bg-background" style={heroStyle}>
      <TodayHero
        locale={locale}
        copy={copy}
        heroDate={heroDate}
        heroPhotoUrl={heroPhoto?.url}
        heroThumbnailUrl={heroPhoto?.thumbnailUrl ?? heroPhoto?.url}
        onSelect={setComposer}
      >
        <TodayActionSheet copy={copy} events={events} onSelect={setComposer} />
      </TodayHero>
      <TodayTimelineSection locale={locale} copy={copy} grouped={grouped} onSelect={setComposer} />

      <EventComposer type={composer} copy={copy} onClose={() => setComposer(null)} onSaved={markSaved} />
    </main>
  );
}
