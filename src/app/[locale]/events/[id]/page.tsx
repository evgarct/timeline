import { ArrowLeft, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MediaStrip } from "@/components/fitness/media-strip";
import { DeleteEventButton } from "@/components/fitness/delete-event-button";
import { Button } from "@/components/ui/button";
import { InBodyReport } from "@/components/fitness/inbody-report";
import { getEvent, listEvents } from "@/data/repository";
import { isInBodyEvent } from "@/domain/inbody";
import { isLocale } from "@/i18n/config";
import { getInBodyCopy } from "@/i18n/inbody-messages";
import { getMessages } from "@/i18n/messages";
import { getCurrentUserId } from "@/lib/current-user";

// The media route downloads by default; an image or PDF opens in the browser tab with ?inline=1.
const withInline = (url: string) => (url.startsWith("/api/media/") ? `${url}?inline=1` : url);

export default async function EventPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getMessages(locale);
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/${locale}`);
  const event = await getEvent(userId, id);
  if (!event) notFound();
  const inbodyCopy = getInBodyCopy(locale);
  // The test before this one gives the change shown next to every reading.
  const previousInBody = event.type === "inbody"
    ? (await listEvents(userId, { type: "inbody", to: new Date(event.occurredAt.getTime() - 1) }, { hydrate: false })).filter(isInBodyEvent)[0]
    : undefined;

  const title = {
    progress_photo: copy.progressPhoto,
    workout: copy.workout,
    measurements: copy.measurements,
    inbody: copy.inbody,
    nutrition_entry: copy.nutrition
  }[event.type];

  return (
    <main className="app-shell px-4 pb-10">
      <header className="flex min-h-16 items-center justify-between">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/${locale}/today`} aria-label="Back"><ArrowLeft /></Link>
        </Button>
        <h1 className="text-sm font-semibold">{title}</h1>
        <Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
      </header>

      <article className="flex flex-col gap-7 pt-4">
        <div className="text-center">
          <time className="text-xl font-semibold">
            {new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(event.occurredAt)}
          </time>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(event.occurredAt)}
          </p>
        </div>

        {event.type === "progress_photo" ? <MediaStrip photos={event.photos} large priority openLabel={copy.openGallery} /> : null}

        {event.type === "workout" ? (
          <div className="surface rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{copy.workout}</p>
            <p className="mt-2 text-2xl font-semibold">{event.muscleGroups.join(" · ")}</p>
          </div>
        ) : null}

        {event.type === "measurements" ? (
          <dl className="surface divide-y overflow-hidden rounded-xl">
            {Object.entries(event.values).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-muted-foreground">{key}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {event.type === "inbody" ? (
          <>
            {event.source.url ? (
              <Button asChild variant="outline" size="lg">
                <a href={withInline(event.source.url)} target="_blank" rel="noreferrer" data-testid="inbody-open-original">
                  <ExternalLink data-icon="inline-start" />
                  {inbodyCopy.openOriginal}
                </a>
              </Button>
            ) : null}
            <InBodyReport event={event} previous={previousInBody} copy={inbodyCopy} locale={locale} />
          </>
        ) : null}

        {event.type === "nutrition_entry" ? (
          <dl className="surface divide-y overflow-hidden rounded-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">{copy.nutrition}</dt>
              <dd className="text-sm font-medium">{event.productSnapshot.name}</dd>
            </div>
            {event.productSnapshot.nutrients.filter((nutrient) => nutrient.value !== undefined).map((nutrient) => (
              <div key={`${nutrient.key ?? nutrient.label}-${nutrient.unit}`} className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-muted-foreground">{nutrient.label}</dt>
                <dd className="text-sm font-medium">{nutrient.value?.toLocaleString(locale)} {nutrient.unit}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {event.note ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold">{copy.note}</h2>
            <p className="text-sm leading-6">{event.note}</p>
          </section>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="lg"><Pencil data-icon="inline-start" />{copy.edit}</Button>
          <DeleteEventButton
            id={event.id}
            returnHref={`/${locale}/today`}
            label={copy.delete}
            cancelLabel={copy.cancel}
            title={copy.deleteConfirmTitle}
            description={copy.deleteConfirmDescription}
            failedLabel={copy.deleteFailed}
          />
        </div>
      </article>
    </main>
  );
}
