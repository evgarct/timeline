"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { getStudioCopy, type StudioCopy } from "@/i18n/studio-messages";
import { useFeedback, useUpdateFeedback, type FeedbackFilter } from "@/lib/studio/api";
import type { FeedbackEntry } from "@/lib/studio/types";
import { spatial } from "@/lib/motion/tokens";
import { Chip, Eyebrow, StudioButton, Surface } from "./ds/primitives";

const statuses: FeedbackEntry["status"][] = ["new", "triaged", "done", "wontfix"];
const categories: FeedbackEntry["category"][] = ["bug", "friction", "missing_tool", "works_well", "suggestion", "other"];

const categoryTone: Record<FeedbackEntry["category"], string> = {
  bug: "bg-[color-mix(in_srgb,var(--s-error)_16%,transparent)] text-[var(--s-error)]",
  friction: "bg-[color-mix(in_srgb,var(--s-warning)_20%,transparent)] text-[var(--s-on-background)]",
  missing_tool: "bg-[color-mix(in_srgb,var(--s-warning)_20%,transparent)] text-[var(--s-on-background)]",
  works_well: "bg-[color-mix(in_srgb,var(--s-success)_20%,transparent)] text-[var(--s-on-background)]",
  suggestion: "bg-[color-mix(in_srgb,var(--s-info)_18%,transparent)] text-[var(--s-on-background)]",
  other: "bg-[var(--s-surface-container-high)] text-[var(--s-on-surface-variant)]"
};

export type FeedbackViewState = "loading" | "error" | "ready";

export interface FeedbackViewProps {
  copy: StudioCopy;
  locale: Locale;
  state: FeedbackViewState;
  entries: FeedbackEntry[];
  filter: FeedbackFilter;
  onFilter: (filter: FeedbackFilter) => void;
  onUpdate: (update: { id: string; status?: FeedbackEntry["status"]; resolution?: string }) => void;
  onRetry: () => void;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--s-on-surface-variant)]">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed">{children}</p>
    </div>
  );
}

function Entry({ entry, copy, locale, onUpdate }: { entry: FeedbackEntry; copy: StudioCopy; locale: Locale; onUpdate: FeedbackViewProps["onUpdate"] }) {
  const f = copy.feedback;
  return (
    <motion.li layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spatial.default}>
      <Surface className="space-y-4 p-5" data-testid="feedback-entry">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${categoryTone[entry.category]}`}>{f.categories[entry.category]}</span>
          {entry.severity ? <span className="text-[var(--s-on-surface-variant)]">{f.severities[entry.severity]}</span> : null}
          {entry.tool ? <code className="rounded-full bg-[var(--s-surface-container-high)] px-2.5 py-1 font-mono text-[11px]">{entry.tool}</code> : null}
          <span className="ml-auto s-num text-[var(--s-on-surface-variant)]">{new Date(entry.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        <h2 className="s-serif text-xl leading-snug">{entry.summary}</h2>
        {entry.details ? <Section label={f.details}>{entry.details}</Section> : null}
        {entry.expected ? <Section label={f.expected}>{entry.expected}</Section> : null}
        {entry.suggestion ? <Section label={f.suggestion}>{entry.suggestion}</Section> : null}
        {entry.toolCalls?.length ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--s-on-surface-variant)]">{f.calls}</div>
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {entry.toolCalls.map((call, index) => (
                <li key={`${call.tool}-${index}`}><code className="font-mono text-[12px]">{call.tool}</code> <span className="text-[var(--s-on-surface-variant)]">— {f.outcomes[call.outcome]}{call.note ? `: ${call.note}` : ""}</span></li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={f.statuses[entry.status]}>
          {statuses.map((status) => (
            <Chip key={status} groupId={`status-${entry.id}`} active={entry.status === status} onClick={() => entry.status !== status && onUpdate({ id: entry.id, status })}>{f.statuses[status]}</Chip>
          ))}
        </div>

        <input
          key={entry.resolution ?? ""}
          defaultValue={entry.resolution ?? ""}
          placeholder={f.resolution}
          aria-label={f.resolution}
          maxLength={1000}
          onBlur={(event) => { if (event.target.value.trim() !== (entry.resolution ?? "")) onUpdate({ id: entry.id, resolution: event.target.value.trim() }); }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          className="h-10 w-full rounded-[var(--s-radius-sm)] bg-transparent px-3 text-sm outline-none ring-1 ring-[var(--s-outline-variant)] transition-shadow placeholder:text-[var(--s-on-surface-variant)] focus:ring-2 focus:ring-[var(--s-primary)]"
        />

        <div className="text-[12px] text-[var(--s-on-surface-variant)]">
          {[f.sources[entry.source], entry.client, entry.page].filter(Boolean).join(" · ")}
        </div>
      </Surface>
    </motion.li>
  );
}

/** Presentational inbox: every state is a prop, so each one has a story. */
export function FeedbackView({ copy, locale, state, entries, filter, onFilter, onUpdate, onRetry }: FeedbackViewProps) {
  const f = copy.feedback;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <header>
        <Eyebrow>{f.eyebrow}</Eyebrow>
        <h1 className="s-serif mt-1 text-4xl tracking-tight md:text-5xl">{f.title}</h1>
      </header>

      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={f.allStatuses}>
          <Chip groupId="filter-status" active={!filter.status} onClick={() => onFilter({ ...filter, status: undefined })}>{f.allStatuses}</Chip>
          {statuses.map((status) => <Chip key={status} groupId="filter-status" active={filter.status === status} onClick={() => onFilter({ ...filter, status })}>{f.statuses[status]}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={f.allCategories}>
          <Chip groupId="filter-category" active={!filter.category} onClick={() => onFilter({ ...filter, category: undefined })}>{f.allCategories}</Chip>
          {categories.map((category) => <Chip key={category} groupId="filter-category" active={filter.category === category} onClick={() => onFilter({ ...filter, category })}>{f.categories[category]}</Chip>)}
        </div>
      </div>

      <div className="mt-8">
        {state === "loading" ? (
          <div className="space-y-4" aria-busy>{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-[var(--s-radius-xl)] bg-[var(--s-surface-container)]" />)}</div>
        ) : state === "error" ? (
          <div className="space-y-4 py-16 text-center">
            <p className="s-serif text-2xl">{f.loadError}</p>
            <StudioButton onClick={onRetry}>{copy.common.retry}</StudioButton>
          </div>
        ) : !entries.length ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spatial.default} className="grid place-items-center rounded-[var(--s-radius-xl)] border border-dashed border-[var(--s-outline-variant)] px-6 py-20 text-center">
            <div className="s-serif text-3xl">{f.empty}</div>
            <p className="mt-2 max-w-sm text-[var(--s-on-surface-variant)]">{f.emptyHint}</p>
          </motion.div>
        ) : (
          <motion.ul layout className="space-y-4">
            <AnimatePresence initial={false}>
              {entries.map((entry) => <Entry key={entry.id} entry={entry} copy={copy} locale={locale} onUpdate={onUpdate} />)}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

export function FeedbackInbox({ locale }: { locale: Locale }) {
  const copy = getStudioCopy(locale);
  const [filter, setFilter] = useState<FeedbackFilter>({});
  const query = useFeedback(filter);
  const update = useUpdateFeedback();
  return (
    <FeedbackView
      copy={copy}
      locale={locale}
      state={query.isPending ? "loading" : query.isError ? "error" : "ready"}
      entries={query.data ?? []}
      filter={filter}
      onFilter={setFilter}
      onUpdate={(patch) => update.mutate(patch)}
      onRetry={() => void query.refetch()}
    />
  );
}
