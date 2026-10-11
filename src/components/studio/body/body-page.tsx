"use client";

import { ExternalLink, Camera, Footprints, Dumbbell, UtensilsCrossed, Ruler } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { BodyCompositionTest, BodyMetricReading } from "@/domain/body-composition";
import { INBODY_TREND_KEYS } from "@/domain/inbody-catalog";
import type { Locale } from "@/i18n/config";
import { getInBodyCopy, metricLabel, type InBodyCopy } from "@/i18n/inbody-messages";
import { getStudioCopy } from "@/i18n/studio-messages";
import { useBodyComposition } from "@/lib/studio/api";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { useLatest } from "@/lib/webmcp/use-latest";
import { useWebMcpTools } from "@/lib/webmcp/use-webmcp";
import { bodyTools } from "../agent/body-tools";
import { LineChart } from "../dashboard/charts";
import { Chip, Eyebrow, NumberTicker, SerifNumber, Surface } from "../ds/primitives";

const HEADLINE = ["inbody_score", "weight", "skeletal_muscle_mass", "percent_body_fat"] as const;

const reading = (test: BodyCompositionTest, key: string) => test.metrics.find((metric) => metric.key === key && !metric.segment);
const signed = (value: number | undefined, locale: string) => (value === undefined || value === 0 ? "" : `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString(locale, { maximumFractionDigits: 2 })}`);
const shortDate = (date: string, locale: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "2-digit" });

function Card({ title, hint, children, className, testId }: { title: string; hint?: string; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <Surface data-testid={testId} className={cn("p-5 md:p-6", className)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spatial.default}>
      <Eyebrow>{title}</Eyebrow>
      {hint ? <p className="mt-0.5 text-[12px] text-[var(--s-on-surface-variant)]">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </Surface>
  );
}

function Interval({ test, copy, locale }: { test: BodyCompositionTest; copy: InBodyCopy; locale: string }) {
  const interval = test.interval;
  if (!interval && !test.photos.length && !test.measurement) return null;
  const number = (value: number | undefined) => (value === undefined ? "–" : Math.round(value).toLocaleString(locale));
  return (
    <div className="mt-4 border-t border-[var(--s-outline-variant)] pt-4" data-testid={`body-interval-${test.id}`}>
      <p className="text-[12px] font-semibold text-[var(--s-on-surface-variant)]">
        {copy.body.between}{interval ? ` · ${interval.days} ${copy.body.days}` : ""}
      </p>
      <ul className="mt-2 grid gap-1.5 text-[13px] sm:grid-cols-2">
        {interval ? (
          <>
            <li className="flex items-start gap-2"><UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-[var(--s-on-surface-variant)]" aria-hidden />
              {interval.nutrition
                ? <span><span className="font-semibold">{copy.body.dietLogged} {interval.nutrition.loggedDays}/{interval.days}</span> · {number(interval.nutrition.avgKcal)} {copy.body.avgKcal}, {number(interval.nutrition.avgProteinG)} g {copy.body.protein}, {number(interval.nutrition.avgFatG)} g {copy.body.fat}, {number(interval.nutrition.avgCarbsG)} g {copy.body.carbs}</span>
                : <span className="text-[var(--s-on-surface-variant)]">{copy.body.noDiet}</span>}
            </li>
            <li className="flex items-start gap-2"><Footprints className="mt-0.5 size-4 shrink-0 text-[var(--s-on-surface-variant)]" aria-hidden />
              {interval.steps ? <span><span className="font-semibold">{number(interval.steps.avgSteps)}</span> {copy.body.steps}</span> : <span className="text-[var(--s-on-surface-variant)]">{copy.body.noSteps}</span>}
            </li>
            <li className="flex items-start gap-2"><Dumbbell className="mt-0.5 size-4 shrink-0 text-[var(--s-on-surface-variant)]" aria-hidden />
              <span><span className="font-semibold">{interval.workouts.count}</span> {copy.body.workouts} · {interval.workouts.setCount} {copy.body.sets} · {interval.workouts.tonnageKg.toLocaleString(locale)} {copy.body.tonnage}</span>
            </li>
          </>
        ) : null}
        {test.photos.length ? (
          <li className="flex items-start gap-2"><Camera className="mt-0.5 size-4 shrink-0 text-[var(--s-on-surface-variant)]" aria-hidden />
            <span><span className="font-semibold">{copy.body.photos}</span> · {test.photos.map((photo) => shortDate(photo.date, locale)).join(", ")}</span>
          </li>
        ) : null}
        {test.measurement ? (
          <li className="flex items-start gap-2"><Ruler className="mt-0.5 size-4 shrink-0 text-[var(--s-on-surface-variant)]" aria-hidden />
            <span><span className="font-semibold">{copy.body.measurements}</span> · {shortDate(test.measurement.date, locale)}{Object.entries(test.measurement.values).slice(0, 4).map(([key, value]) => ` · ${copy.body.tape[key] ?? key} ${value}`).join("")}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TestCard({ test, locale, copy }: { test: BodyCompositionTest; locale: Locale; copy: InBodyCopy }) {
  return (
    <Surface className="p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spatial.default} data-testid={`body-test-${test.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[17px] font-semibold">{shortDate(test.date, locale)}</div>
          <div className="text-[12px] text-[var(--s-on-surface-variant)]">{test.extraction.reviewed ? copy.reviewed : copy.notReviewed}{test.report?.device ? ` · ${test.report.device}` : ""}</div>
        </div>
        <div className="flex items-center gap-3 text-[13px] font-medium">
          {test.originalAssetId ? (
            <a href={`/api/media/${test.originalAssetId}?inline=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--s-primary)] underline-offset-4 hover:underline" data-testid="body-open-original">
              <ExternalLink className="size-3.5" aria-hidden />{copy.openOriginal}
            </a>
          ) : null}
          <Link href={`/${locale}/events/${test.id}`} className="text-[var(--s-primary)] underline-offset-4 hover:underline">{copy.body.openSheet}</Link>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HEADLINE.map((key) => {
          const metric = reading(test, key);
          if (!metric) return null;
          return (
            <div key={key}>
              <dt className="text-[11px] text-[var(--s-on-surface-variant)]">{metricLabel(copy, metric)}</dt>
              <dd className="s-num text-[20px] font-semibold">{metric.value.toLocaleString(locale, { maximumFractionDigits: 2 })}<span className="ml-1 text-[12px] font-normal text-[var(--s-on-surface-variant)]">{metric.unit === "points" ? "" : metric.unit}</span></dd>
              <dd className="s-num h-4 text-[12px] text-[var(--s-on-surface-variant)]">{signed(metric.deltaFromPrevious, locale)}</dd>
            </div>
          );
        })}
      </dl>
      <Interval test={test} copy={copy} locale={locale} />
    </Surface>
  );
}

/**
 * The Body page: one trend chart per metric across InBody tests, then every test with its headline numbers and what
 * happened between two tests (diet, steps, training, progress photos, tape measurements), so the numbers come with
 * their explanation.
 */
export function BodyPage({ locale, timezone }: { locale: Locale; timezone?: string }) {
  const copy = getStudioCopy(locale);
  const inbody = getInBodyCopy(locale);
  const zone = timezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  const query = useBodyComposition(zone);
  const tests = useMemo(() => query.data ?? [], [query.data]);
  const [selected, setSelected] = useState<string>();

  const available = useMemo(() => INBODY_TREND_KEYS.filter((key) => tests.some((test) => reading(test, key))), [tests]);
  const metric = selected && available.includes(selected as never) ? selected : available.includes("weight") ? "weight" : available[0];
  const latest = tests.at(-1);
  const latestReading = latest && metric ? reading(latest, metric) : undefined;
  const points = useMemo(() => tests.flatMap((test) => {
    const found = metric ? reading(test, metric) : undefined;
    return found ? [{ label: shortDate(test.date, locale), value: found.value, date: test.date, deltaFromPrevious: found.deltaFromPrevious }] : [];
  }), [tests, metric, locale]);

  // What the human sees, as data: the copilot reads this through body_get_view and steers it with body_select_metric.
  const view = {
    selectedMetric: metric ?? null,
    metricsAvailable: available,
    chart: points.map(({ date, value, deltaFromPrevious }) => ({ date, value, deltaFromPrevious: deltaFromPrevious ?? null })),
    tests: [...tests].reverse().map((test) => ({
      id: test.id,
      date: test.date,
      headline: Object.fromEntries(HEADLINE.flatMap((key) => { const found = reading(test, key); return found ? [[key, { value: found.value, deltaFromPrevious: found.deltaFromPrevious ?? null }]] : []; })),
      interval: test.interval,
      photos: test.photos.length,
      reviewed: test.extraction.reviewed
    }))
  };
  const getView = useLatest(view);
  const agentTools = useMemo(() => bodyTools({
    getView,
    selectMetric: (key) => {
      if (!getView().metricsAvailable.includes(key as never)) return false;
      setSelected(key);
      return true;
    }
  }), [getView]);
  useWebMcpTools(agentTools);

  const first = tests[0];
  const change = latest && metric && first && latest !== first ? reading(latest, metric)?.deltaFromFirst : undefined;
  const unit = (latestReading as BodyMetricReading | undefined)?.unit === "points" ? "" : latestReading?.unit;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-10 lg:px-8">
      <header>
        <Eyebrow>{inbody.body.eyebrow}</Eyebrow>
        <h1 className="s-serif mt-1 text-4xl tracking-tight md:text-5xl">{inbody.body.title}</h1>
      </header>

      {query.isError ? (
        <p role="alert" className="rounded-[var(--s-radius-lg)] bg-[color-mix(in_srgb,var(--s-error)_12%,transparent)] p-4 text-sm">{inbody.body.loadError}</p>
      ) : null}

      {query.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label={copy.common.loading} data-testid="body-loading">
          <div className="h-72 animate-pulse rounded-[var(--s-radius-xl)] bg-[var(--s-surface-container)]" />
          <div className="h-40 animate-pulse rounded-[var(--s-radius-xl)] bg-[var(--s-surface-container)]" />
        </div>
      ) : null}

      {!query.isPending && !query.isError && !tests.length ? (
        <Surface className="p-10 text-center" data-testid="body-empty">
          <p className="text-[17px] font-semibold">{inbody.body.empty}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--s-on-surface-variant)]">{inbody.body.emptyHint}</p>
        </Surface>
      ) : null}

      {tests.length ? (
        <>
          <Card title={inbody.body.chartTrend} testId="body-trend">
            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label={inbody.body.metric}>
              {available.map((key) => {
                const sample = tests.map((test) => reading(test, key)).find(Boolean);
                return <Chip key={key} groupId="body-metric" active={key === metric} onClick={() => setSelected(key)}>{sample ? metricLabel(inbody, sample) : key}</Chip>;
              })}
            </div>
            <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-2">
              {latestReading ? (
                <div>
                  <Eyebrow>{inbody.body.latest}</Eyebrow>
                  <SerifNumber size={44} unit={unit} value={<NumberTicker value={latestReading.value} decimals={Number.isInteger(latestReading.value) ? 0 : 1} />} />
                </div>
              ) : null}
              {change !== undefined ? (
                <div>
                  <Eyebrow>{inbody.body.change}</Eyebrow>
                  <div className="s-num text-[22px] font-semibold" data-testid="body-change">{signed(change, locale) || "0"} <span className="text-[13px] font-normal text-[var(--s-on-surface-variant)]">{unit} · {inbody.sinceFirst}</span></div>
                </div>
              ) : null}
            </div>
            {points.length >= 2
              ? <LineChart key={metric} points={points} unit={unit ?? ""} />
              : <p className="py-10 text-center text-sm text-[var(--s-on-surface-variant)]">{inbody.body.oneTest}</p>}
          </Card>

          <div className="space-y-4" data-testid="body-tests" aria-label={inbody.body.tests}>
            {[...tests].reverse().map((test) => <TestCard key={test.id} test={test} locale={locale} copy={inbody} />)}
          </div>
        </>
      ) : null}
    </div>
  );
}
