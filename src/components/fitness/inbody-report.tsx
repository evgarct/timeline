import { CheckCircle2, CircleDashed } from "lucide-react";
import type { InBodyMetric } from "@/domain/events";
import { findMetric, inBodyHeadline, metricDelta, type InBodyEvent } from "@/domain/inbody";
import { INBODY_SEGMENTS, type InBodyCategory, type InBodySegment } from "@/domain/inbody-catalog";
import { metricLabel, type InBodyCopy } from "@/i18n/inbody-messages";

const SHEET_SECTIONS: InBodyCategory[] = ["composition", "obesity", "control", "research"];

export function formatReading(value: number, locale: string) {
  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/** A neutral signed change; the sheet does not say whether up or down is good, so no good/bad colouring. */
export function SignedDelta({ value, locale, className }: { value: number | undefined; locale: string; className?: string }) {
  if (value === undefined || value === 0) return null;
  return <span className={className ?? "text-xs text-muted-foreground"}>{value > 0 ? "+" : "−"}{formatReading(Math.abs(value), locale)}</span>;
}

/** The sheet's normal range as a band with the reading as a dot. */
export function ReferenceBar({ metric, label }: { metric: Pick<InBodyMetric, "value" | "referenceMin" | "referenceMax">; label: string }) {
  const { referenceMin: min, referenceMax: max, value } = metric;
  if (min === undefined || max === undefined || max <= min) return null;
  const pad = (max - min) * 0.4;
  const lo = Math.min(min, value) - pad;
  const hi = Math.max(max, value) + pad;
  const at = (point: number) => `${(((point - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  return (
    <span role="img" aria-label={`${label} ${min}–${max}`} className="relative mt-1.5 block h-1.5 w-full rounded-full bg-muted">
      <span className="absolute inset-y-0 rounded-full bg-foreground/15" style={{ left: at(min), width: `calc(${at(max)} - ${at(min)})` }} />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background" style={{ left: at(value) }} />
    </span>
  );
}

function Row({ metric, previous, copy, locale }: { metric: InBodyMetric; previous?: InBodyEvent; copy: InBodyCopy; locale: string }) {
  const delta = previous ? metricDelta({ metrics: [metric] }, previous, metric.key) : undefined;
  const range = metric.referenceMin !== undefined && metric.referenceMax !== undefined ? `${formatReading(metric.referenceMin, locale)}–${formatReading(metric.referenceMax, locale)}` : undefined;
  return (
    <div className="px-4 py-3" data-testid={`inbody-metric-${metric.key}`}>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted-foreground">{metricLabel(copy, metric)}</dt>
        <dd className="flex items-baseline gap-2 text-sm font-medium tabular-nums">
          <SignedDelta value={delta} locale={locale} />
          <span>{formatReading(metric.value, locale)}{metric.unit ? ` ${metric.unit}` : ""}</span>
        </dd>
      </div>
      <ReferenceBar metric={metric} label={copy.reference} />
      {range || metric.evaluation ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {range ? `${copy.reference} ${range}` : null}
          {range && metric.evaluation ? " · " : null}
          {metric.evaluation ? copy.evaluation[metric.evaluation] : null}
        </p>
      ) : null}
    </div>
  );
}

function SegmentGrid({ event, keys, copy, locale, testId }: { event: InBodyEvent; keys: { kg: string; pct: string }; copy: InBodyCopy; locale: string; testId: string }) {
  const cell = (segment: InBodySegment) => {
    const kg = findMetric(event, keys.kg, segment);
    const pct = findMetric(event, keys.pct, segment);
    return (
      <div key={segment} className="rounded-lg bg-muted/60 p-3 text-center" data-testid={`${testId}-${segment}`}>
        <p className="text-[11px] text-muted-foreground">{copy.segments[segment]}</p>
        <p className="mt-1 text-base font-semibold tabular-nums">{kg ? `${formatReading(kg.value, locale)} ${kg.unit ?? ""}` : "–"}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {pct ? `${formatReading(pct.value, locale)} %` : ""}{pct?.evaluation ? ` · ${copy.evaluation[pct.evaluation]}` : ""}
        </p>
      </div>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {cell("left_arm")}
      {cell("right_arm")}
      <div className="col-span-2">{cell("trunk")}</div>
      {cell("left_leg")}
      {cell("right_leg")}
    </div>
  );
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h2 className="px-1 text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="surface overflow-hidden rounded-xl">{children}</div>
    </section>
  );
}

/**
 * One InBody sheet, every reading: key numbers with the change since the previous test, then the printed sections with
 * their normal ranges, the five-segment lean and fat grids, impedance and the exercise table.
 */
export function InBodyReport({ event, previous, copy, locale }: { event: InBodyEvent; previous?: InBodyEvent; copy: InBodyCopy; locale: string }) {
  const headline = inBodyHeadline(event).slice(0, 4);
  const plain = (category: InBodyCategory) => event.metrics.filter((metric) => metric.category === category && !metric.segment);
  const hasSegments = (category: InBodyCategory) => event.metrics.some((metric) => metric.category === category && metric.segment);
  const impedance = event.metrics.filter((metric) => metric.category === "impedance" && metric.segment);
  const frequencies = [...new Set(impedance.map((metric) => metric.frequencyKhz).filter((value): value is number => value !== undefined))].sort((a, b) => a - b);
  const exercise = plain("exercise");
  const other = plain("other").filter((metric) => !headline.some((item) => item.key === metric.key));
  const header = [event.report?.device, event.report?.heightCm ? `${event.report.heightCm} cm` : undefined, event.report?.ageYears ? `${event.report.ageYears}` : undefined].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6" data-testid="inbody-report">
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        {event.extraction.reviewed ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
        {event.extraction.reviewed ? copy.reviewed : copy.notReviewed}
        {header ? ` · ${header}` : ""}
      </p>

      {headline.length ? (
        <section className="flex flex-col gap-2" data-testid="inbody-headline">
          <h2 className="px-1 text-xs font-semibold text-muted-foreground">{copy.headline}</h2>
          <div className="grid grid-cols-2 gap-2">
            {headline.map((metric) => (
              <div key={metric.key} className="surface rounded-xl p-4" data-testid={`inbody-headline-${metric.key}`}>
                <p className="text-xs text-muted-foreground">{metricLabel(copy, metric)}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatReading(metric.value, locale)}<span className="ml-1 text-xs font-normal text-muted-foreground">{metric.unit === "points" ? "" : metric.unit}</span></p>
                <p className="mt-0.5 h-4"><SignedDelta value={previous ? metricDelta(event, previous, metric.key) : undefined} locale={locale} className="text-xs text-muted-foreground" /></p>
              </div>
            ))}
          </div>
          {previous ? <p className="px-1 text-[11px] text-muted-foreground">{copy.sinceLast}</p> : null}
        </section>
      ) : null}

      {SHEET_SECTIONS.map((category) => (plain(category).length ? (
        <Section key={category} title={copy.sections[category]} testId={`inbody-section-${category}`}>
          <dl className="divide-y">{plain(category).map((metric) => <Row key={metric.key} metric={metric} previous={previous} copy={copy} locale={locale} />)}</dl>
        </Section>
      ) : null))}

      {other.length ? (
        <Section title={copy.sections.other} testId="inbody-section-other">
          <dl className="divide-y">{other.map((metric) => <Row key={metric.key} metric={metric} previous={previous} copy={copy} locale={locale} />)}</dl>
        </Section>
      ) : null}

      {hasSegments("segmental_lean") ? (
        <Section title={copy.sections.segmental_lean} testId="inbody-section-segmental_lean">
          <SegmentGrid event={event} keys={{ kg: "lean_mass_kg", pct: "lean_mass_pct" }} copy={copy} locale={locale} testId="inbody-lean" />
        </Section>
      ) : null}
      {hasSegments("segmental_fat") ? (
        <Section title={copy.sections.segmental_fat} testId="inbody-section-segmental_fat">
          <SegmentGrid event={event} keys={{ kg: "fat_mass_kg", pct: "fat_mass_pct" }} copy={copy} locale={locale} testId="inbody-fat" />
        </Section>
      ) : null}

      {impedance.length ? (
        <Section title={copy.sections.impedance} testId="inbody-section-impedance">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-normal">{copy.frequency}</th>
                {frequencies.map((frequency) => <th key={frequency} className="px-2 py-2 text-right font-normal">{frequency} kHz</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {INBODY_SEGMENTS.map((segment) => (
                <tr key={segment}>
                  <td className="px-4 py-2 text-muted-foreground">{copy.segments[segment]}</td>
                  {frequencies.map((frequency) => {
                    const reading = findMetric(event, "impedance_ohm", segment, frequency);
                    return <td key={frequency} className="px-2 py-2 text-right font-medium">{reading ? formatReading(reading.value, locale) : "–"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {exercise.length ? (
        <details className="surface overflow-hidden rounded-xl" data-testid="inbody-section-exercise">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{copy.sections.exercise}</summary>
          <dl className="divide-y border-t">
            {exercise.map((metric) => (
              <div key={metric.key} className="flex items-baseline justify-between px-4 py-2.5">
                <dt className="text-sm text-muted-foreground">{metricLabel(copy, metric)}</dt>
                <dd className="text-sm font-medium tabular-nums">{formatReading(metric.value, locale)} {metric.unit}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
