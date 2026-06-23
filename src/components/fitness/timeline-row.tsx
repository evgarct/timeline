import Link from "next/link";
import type { TimelineEvent } from "@/domain/events";
import type { Copy } from "@/i18n/messages";
import { EventIcon } from "./icon";
import { MediaStrip } from "./media-strip";

function titleFor(event: TimelineEvent, copy: Copy) {
  return {
    progress_photo: copy.progressPhoto,
    workout: copy.workout,
    measurements: copy.measurements,
    inbody: copy.inbody
  }[event.type];
}

function detailsFor(event: TimelineEvent, copy: Copy) {
  if (event.type === "workout") return event.muscleGroups.join(" · ");
  if (event.type === "measurements") {
    const pieces = [];
    if (event.values.weightKg) pieces.push(`${copy.weight} ${event.values.weightKg} kg`);
    if (event.values.waistCm) pieces.push(`${copy.waist} ${event.values.waistCm} cm`);
    return pieces.join(" · ");
  }
  if (event.type === "inbody") {
    return event.metrics
      .filter((metric) => ["weight", "percent_body_fat"].includes(metric.key))
      .map((metric) => `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`)
      .join(" · ");
  }
  return copy.photoCount.replace("{count}", String(event.photos.length));
}

export function TimelineRow({
  event,
  copy,
  locale,
  rail = true
}: {
  event: TimelineEvent;
  copy: Copy;
  locale: string;
  rail?: boolean;
}) {
  return (
    <div className={rail ? "relative pl-8" : "relative"}>
      {rail ? <span className="absolute left-0 top-7 size-2.5 rounded-full bg-foreground ring-4 ring-background" /> : null}
      <Link
        href={`/${locale}/events/${event.id}`}
        className="surface flex min-h-16 items-center gap-3 rounded-xl p-3 transition-transform active:scale-[0.99]"
      >
        <EventIcon type={event.type} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{titleFor(event, copy)}</span>
          <span className="block truncate text-xs text-muted-foreground">{detailsFor(event, copy)}</span>
          {event.type === "progress_photo" ? (
            <span className="mt-2 block max-w-48">
              <MediaStrip photos={event.photos} openLabel={copy.openGallery} interactive={false} />
            </span>
          ) : null}
        </span>
      </Link>
    </div>
  );
}
