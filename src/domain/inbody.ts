import type { InBodyMetric, TimelineEvent } from "./events";
import { INBODY_SUMMARY_KEYS, inBodyMetricIdentity, type InBodySegment } from "./inbody-catalog";

export type InBodyEvent = Extract<TimelineEvent, { type: "inbody" }>;

export const isInBodyEvent = (event: TimelineEvent): event is InBodyEvent => event.type === "inbody";

/** The reading for a key (and segment / frequency where the sheet has them), or undefined when the sheet lacks it. */
export function findMetric(
  event: Pick<InBodyEvent, "metrics">, key: string, segment?: InBodySegment, frequencyKhz?: number
): InBodyMetric | undefined {
  const identity = inBodyMetricIdentity({ key, segment, frequencyKhz });
  return event.metrics.find((metric) => inBodyMetricIdentity(metric) === identity);
}

export const metricValue = (event: Pick<InBodyEvent, "metrics">, key: string, segment?: InBodySegment, frequencyKhz?: number) =>
  findMetric(event, key, segment, frequencyKhz)?.value;

/** Headline readings of a test in display order; missing ones are skipped. */
export function inBodyHeadline(event: Pick<InBodyEvent, "metrics">) {
  return INBODY_SUMMARY_KEYS.flatMap((key) => {
    const metric = findMetric(event, key);
    return metric ? [metric] : [];
  });
}

/** Signed change rounded to the precision of the sheet (one decimal), or undefined when either test lacks the metric. */
export function metricDelta(current: Pick<InBodyEvent, "metrics">, previous: Pick<InBodyEvent, "metrics"> | undefined, key: string) {
  const now = metricValue(current, key);
  const before = previous ? metricValue(previous, key) : undefined;
  if (now === undefined || before === undefined) return undefined;
  return Math.round((now - before) * 100) / 100;
}

/** InBody events ordered oldest to newest. */
export function sortInBodyTests<T extends { occurredAt: Date | string }>(tests: T[]) {
  return [...tests].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

/** One short line for lists: score, weight, SMM, body fat. */
export function inBodyLine(event: Pick<InBodyEvent, "metrics">) {
  return inBodyHeadline(event)
    .slice(0, 4)
    .map((metric) => `${metric.key} ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`)
    .join(", ");
}

/**
 * Every reading of one sheet as compact text for agents (the generic JSON repeats label, unit and category on each of
 * about 150 readings): `key[segment@kHz] value unit (reference min-max) evaluation`, grouped by category.
 */
export function inBodyText(event: InBodyEvent) {
  const groups = new Map<string, string[]>();
  for (const metric of event.metrics) {
    const name = `${metric.key}${metric.segment ? `[${metric.segment}${metric.frequencyKhz ? `@${metric.frequencyKhz}kHz` : ""}]` : ""}`;
    const reference = metric.referenceMin !== undefined || metric.referenceMax !== undefined ? ` (ref ${metric.referenceMin ?? ""}-${metric.referenceMax ?? ""})` : "";
    const line = `${name} ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}${reference}${metric.evaluation ? ` ${metric.evaluation}` : ""}`;
    groups.set(metric.category, [...(groups.get(metric.category) ?? []), line]);
  }
  const header = [
    `InBody test ${event.occurredAt.toISOString().slice(0, 16)} (${event.timezone}), id ${event.id}`,
    event.report ? `sheet: ${Object.entries(event.report).map(([key, value]) => `${key} ${value}`).join(", ")}` : undefined,
    `original file: ${event.source.fileName} (${event.source.mimeType})${event.source.assetId ? `, asset ${event.source.assetId}: get_inbody_original gives a link` : ""}`,
    `extraction: ${event.extraction.method}, ${event.extraction.reviewed ? "reviewed" : "not yet reviewed"}`,
    event.note ? `note: ${event.note}` : undefined
  ].filter(Boolean);
  return [...header, ...[...groups.entries()].map(([category, lines]) => `${category}: ${lines.join("; ")}`)].join("\n");
}

/** Where a value sits against the sheet's own reference range. */
export function referenceStatus(metric: Pick<InBodyMetric, "value" | "referenceMin" | "referenceMax">) {
  if (metric.referenceMin !== undefined && metric.value < metric.referenceMin) return "under" as const;
  if (metric.referenceMax !== undefined && metric.value > metric.referenceMax) return "over" as const;
  if (metric.referenceMin !== undefined || metric.referenceMax !== undefined) return "normal" as const;
  return undefined;
}
