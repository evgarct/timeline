"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { estimateOneRepMaxKg } from "@/domain/exercises";
import type { Locale } from "@/i18n/config";
import { getStudioCopy, muscleLabel } from "@/i18n/studio-messages";
import { useExerciseHistory, useMuscleVolume, useRecentSessions, useTemplates } from "@/lib/studio/api";
import type { RecentWorkoutSession } from "@/lib/studio/types";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { useLatest } from "@/lib/webmcp/use-latest";
import { useWebMcpTools } from "@/lib/webmcp/use-webmcp";
import { dashboardTools } from "../agent/dashboard-tools";
import { MuscleMap } from "../ds/muscle-map";
import { Chip, Eyebrow, NumberTicker, SerifNumber, Surface } from "../ds/primitives";
import { ConsistencyGrid, LineChart, WeekBars } from "./charts";

const dayKey = (iso: string, timezone: string) => {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
  catch { return iso.slice(0, 10); }
};

function bestE1rm(sessions: RecentWorkoutSession[]) {
  let best = 0;
  for (const session of sessions) for (const exercise of session.exercises) for (const set of exercise.sets) {
    if (set.completed === false || set.setType === "warmup" || set.weightKg == null || set.reps == null) continue;
    best = Math.max(best, estimateOneRepMaxKg(set.weightKg, set.reps) ?? 0);
  }
  return best;
}

function Card({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <Surface className={cn("p-5 md:p-6", className)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spatial.default}>
      <Eyebrow>{title}</Eyebrow>
      {hint ? <p className="mt-0.5 text-[12px] text-[var(--s-on-surface-variant)]">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </Surface>
  );
}

function Kpi({ label, value, unit, decimals = 0, sub }: { label: string; value: number; unit?: string; decimals?: number; sub?: string }) {
  return (
    <Surface tone="primary" className="p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spatial.default}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2"><SerifNumber size={44} unit={unit} value={<NumberTicker value={value} decimals={decimals} />} /></div>
      {sub ? <div className="mt-1 text-[12px] text-[var(--s-on-surface-variant)]">{sub}</div> : null}
    </Surface>
  );
}

export function Dashboard({ locale }: { locale: Locale }) {
  const copy = getStudioCopy(locale);
  const sessionsQuery = useRecentSessions(200);
  const volumeQuery = useMuscleVolume(12);
  const templates = useTemplates();
  const [selectedWeek, setSelectedWeek] = useState<string>();
  const [exerciseId, setExerciseId] = useState<string>();
  const [openSession, setOpenSession] = useState<string>();

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  // The API returns newest first; charts read left to right in time.
  const weeks = useMemo(() => [...(volumeQuery.data ?? [])].sort((a, b) => a.weekStart.localeCompare(b.weekStart)), [volumeQuery.data]);
  const week = weeks.find((entry) => entry.weekStart === selectedWeek) ?? weeks.at(-1);
  const lastWeek = week ? weeks[weeks.indexOf(week) - 1] : undefined;

  const exercisesInUse = useMemo(() => {
    const seen = new Map<string, { name: string; count: number }>();
    for (const session of sessions) for (const exercise of session.exercises) {
      const entry = seen.get(exercise.exerciseId) ?? { name: exercise.name, count: 0 };
      seen.set(exercise.exerciseId, { name: entry.name, count: entry.count + 1 });
    }
    return [...seen.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  }, [sessions]);
  const activeExercise = exerciseId ?? exercisesInUse[0]?.[0];
  const history = useExerciseHistory(activeExercise);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const session of sessions) { const key = dayKey(session.occurredAt, session.timezone); map[key] = (map[key] ?? 0) + 1; }
    return map;
  }, [sessions]);

  const weekTonnage = useMemo(() => {
    if (!week) return 0;
    const start = new Date(`${week.weekStart}T00:00:00`).getTime();
    return Math.round(sessions.filter((s) => { const t = new Date(s.occurredAt).getTime(); return t >= start && t < start + 7 * 864e5; }).reduce((sum, s) => sum + s.summary.tonnageKg, 0));
  }, [sessions, week]);
  const weekSessions = week ? sessions.filter((s) => { const t = new Date(s.occurredAt).getTime(); const start = new Date(`${week.weekStart}T00:00:00`).getTime(); return t >= start && t < start + 7 * 864e5; }).length : 0;

  const intensity = useMemo(() => {
    if (!week) return undefined;
    const max = Math.max(1, ...Object.values(week.sets));
    return Object.fromEntries(Object.entries(week.sets).map(([muscle, value]) => [muscle, value / max]));
  }, [week]);

  const points = useMemo(() => (history.data?.recentSessions ?? []).filter((entry) => entry.bestE1rmKg).map((entry) => ({ label: entry.date.slice(5), value: entry.bestE1rmKg as number })).reverse(), [history.data]);
  const failed = sessionsQuery.isError || volumeQuery.isError;
  const base = `/${locale}/studio/templates`;

  // What the human sees, as data: the copilot reads this through dashboard_get_view and steers it with the select tools.
  const view = {
    selectedWeek: week?.weekStart ?? null,
    weeks: weeks.map((entry) => ({ weekStart: entry.weekStart, totalSets: entry.totalSets })),
    kpis: { weekSets: week?.totalSets ?? 0, lastWeekSets: lastWeek?.totalSets ?? null, tonnageKg: weekTonnage, sessions: weekSessions, bestE1rmKg: bestE1rm(sessions) },
    setsPerMuscle: week?.sets ?? {},
    exercisesAvailable: exercisesInUse.map(([id, entry]) => ({ id, name: entry.name })),
    chart: { exerciseId: activeExercise ?? null, e1rmKg: points },
    recentSessions: sessions.slice(0, 10).map((session) => ({ eventId: session.eventId, date: session.occurredAt, muscleGroups: session.muscleGroups, ...session.summary }))
  };
  const getView = useLatest(view);
  const agentTools = useMemo(() => dashboardTools({
    getView,
    selectWeek: (weekStart) => {
      if (!getView().weeks.some((entry) => entry.weekStart === weekStart)) return false;
      setSelectedWeek(weekStart);
      return true;
    },
    selectExercise: (exerciseId) => {
      if (!getView().exercisesAvailable.some((entry) => entry.id === exerciseId)) return false;
      setExerciseId(exerciseId);
      return true;
    }
  }), [getView]);
  useWebMcpTools(agentTools);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-10 lg:px-8">
      <header>
        <Eyebrow>{copy.dashboard.eyebrow}</Eyebrow>
        <h1 className="s-serif mt-1 text-4xl tracking-tight md:text-5xl">{copy.dashboard.title}</h1>
      </header>

      {failed ? <p className="rounded-[var(--s-radius-lg)] bg-[color-mix(in_srgb,var(--s-error)_12%,transparent)] p-4 text-sm">{copy.dashboard.loadError}</p> : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="KPI">
        <Kpi label={copy.dashboard.weekSets} value={week?.totalSets ?? 0} sub={lastWeek ? `${copy.dashboard.lastWeek}: ${lastWeek.totalSets}` : undefined} />
        <Kpi label={copy.dashboard.tonnage} value={weekTonnage} unit={copy.common.kg} />
        <Kpi label={copy.dashboard.sessions} value={weekSessions} />
        <Kpi label={copy.dashboard.bestE1rm} value={bestE1rm(sessions)} unit={copy.common.kg} decimals={1} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card title={copy.dashboard.volume} hint={copy.dashboard.volumeHint}>
            {weeks.length ? <WeekBars bars={weeks.map((entry) => ({ key: entry.weekStart, label: entry.weekStart.slice(5), value: entry.totalSets }))} selected={week?.weekStart ?? ""} onSelect={setSelectedWeek} unit={copy.common.sets} /> : <p className="py-10 text-center text-sm text-[var(--s-on-surface-variant)]">{copy.dashboard.noData}</p>}
          </Card>

          <Card title={copy.dashboard.strength} hint={copy.dashboard.strengthHint}>
            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {exercisesInUse.map(([id, entry]) => <Chip key={id} groupId="strength" active={id === activeExercise} onClick={() => setExerciseId(id)}>{entry.name}</Chip>)}
            </div>
            {points.length >= 2 ? <LineChart key={activeExercise} points={points} unit={copy.common.kg} /> : <p className="py-10 text-center text-sm text-[var(--s-on-surface-variant)]">{copy.dashboard.noData}</p>}
          </Card>

          <Card title={copy.dashboard.history}>
            <ul className="divide-y divide-[var(--s-outline-variant)]">
              {sessions.slice(0, 12).map((session) => {
                const open = openSession === session.eventId;
                return (
                  <li key={session.eventId}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenSession(open ? undefined : session.eventId)} className="flex w-full items-center justify-between gap-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                      <span>
                        <span className="block text-[15px] font-semibold">{new Date(session.occurredAt).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}</span>
                        <span className="block text-[12px] text-[var(--s-on-surface-variant)]">{session.muscleGroups.map((muscle) => muscleLabel(copy, muscle)).join(" · ")}</span>
                      </span>
                      <span className="s-num text-[12px] text-[var(--s-on-surface-variant)]">{session.summary.exerciseCount} {copy.common.exercises} · {session.summary.setCount} {copy.common.sets} · {Math.round(session.summary.tonnageKg)} {copy.common.kg}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.22, ease: [0.2, 0, 0, 1] }, opacity: { duration: 0.15 } }} className="overflow-hidden">
                          <div className="space-y-3 pb-4">
                            {session.note ? <p className="text-sm text-[var(--s-on-surface-variant)]">{session.note}</p> : null}
                            {session.exercises.map((exercise) => (
                              <div key={exercise.exerciseId}>
                                <div className="text-[14px] font-semibold">{exercise.name}</div>
                                <div className="s-num text-[13px] text-[var(--s-on-surface-variant)]">{exercise.sets.map((set) => `${set.weightKg ?? "–"}×${set.reps ?? "–"}${set.setType === "warmup" ? " W" : set.setType === "drop" ? " D" : set.rir != null ? ` @${set.rir}` : ""}`).join("  ·  ")}</div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </li>
                );
              })}
              {!sessions.length && !sessionsQuery.isPending ? <li className="py-8 text-center text-sm text-[var(--s-on-surface-variant)]">{copy.dashboard.noData}</li> : null}
            </ul>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title={copy.dashboard.heatmap} hint={week?.weekStart}>
            <div className="h-[280px]"><MuscleMap intensity={intensity} /></div>
            <ul className="mt-4 space-y-1.5 text-[13px]">
              {Object.entries(week?.sets ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([muscle, value]) => (
                <li key={muscle} className="flex justify-between"><span>{muscleLabel(copy, muscle)}</span><span className="s-num font-semibold">{value}</span></li>
              ))}
            </ul>
          </Card>
          <Card title={copy.dashboard.consistency}>
            <ConsistencyGrid counts={counts} weeks={12} />
          </Card>
          <Card title={copy.dashboard.startFromTemplate}>
            <ul className="space-y-2">
              {(templates.data ?? []).slice(0, 4).map((template) => (
                <li key={template.id}><Link href={`${base}/${template.id}`} className="flex items-center justify-between rounded-[var(--s-radius-md)] bg-[var(--s-surface-container-high)] px-4 py-3 text-[15px] font-semibold outline-none transition-colors hover:bg-[var(--s-primary-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">{template.name}<span className="s-num text-[12px] font-normal text-[var(--s-on-surface-variant)]">{template.exercises.length}</span></Link></li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
