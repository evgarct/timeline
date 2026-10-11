"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { effects, spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

export interface Bar { key: string; label: string; value: number }

/** Weekly bars. The selected week is full primary, the rest tonal; bars grow with the fast spatial spring. */
export function WeekBars({ bars, selected, onSelect, unit }: { bars: Bar[]; selected: string; onSelect: (key: string) => void; unit: string }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className="flex h-44 items-end gap-1.5" role="group" aria-label={unit}>
      {bars.map((bar, index) => (
        <button
          key={bar.key}
          type="button"
          aria-label={`${bar.label}: ${bar.value} ${unit}`}
          aria-pressed={bar.key === selected}
          onClick={() => onSelect(bar.key)}
          className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"
        >
          <span className="s-num text-[11px] text-[var(--s-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{bar.value}</span>
          <motion.span
            className={cn("w-full origin-bottom rounded-t-[8px] transition-colors", bar.key === selected ? "bg-[var(--s-primary)] shadow-[0_0_24px_-4px_var(--s-glow)]" : "bg-[color-mix(in_srgb,var(--s-primary)_38%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--s-primary)_60%,transparent)]")}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(3, (bar.value / max) * 100)}%` }}
            transition={{ ...spatial.fast, delay: index * 0.02 }}
          />
          <span className="text-[10px] text-[var(--s-on-surface-variant)]">{bar.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface Point { label: string; value: number }

/** Smooth-ish line with a self-drawing stroke and a glowing last point. Pure SVG, no chart dependency. */
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const id = useId();
  const width = 600;
  const height = 200;
  const pad = 24;
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const x = (index: number) => pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const d = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const bestIndex = values.indexOf(max);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${points[0].label} – ${points[last].label}: ${min}–${max} ${unit}`}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--s-primary)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--s-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={width - pad} y1={pad + t * (height - pad * 2)} y2={pad + t * (height - pad * 2)} stroke="var(--s-outline-variant)" strokeDasharray="3 5" />)}
      <motion.path d={`${d} L${x(last)} ${height - pad} L${x(0)} ${height - pad} Z`} fill={`url(#${id}-fill)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={effects.slow} />
      <motion.path d={d} fill="none" stroke="var(--s-primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }} />
      {points.map((point, index) => (
        <motion.circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r={index === bestIndex ? 6 : 3.5} fill={index === bestIndex ? "var(--s-primary)" : "var(--s-surface)"} stroke="var(--s-primary)" strokeWidth={2} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spatial.default, delay: 0.5 + index * 0.03 }} style={{ transformOrigin: `${x(index)}px ${y(point.value)}px`, filter: index === bestIndex ? "drop-shadow(0 0 8px var(--s-glow))" : undefined }}>
          <title>{`${point.label}: ${point.value} ${unit}`}</title>
        </motion.circle>
      ))}
      <text x={pad} y={height - 4} fontSize="11" fill="var(--s-on-surface-variant)">{points[0].label}</text>
      <text x={width - pad} y={height - 4} fontSize="11" textAnchor="end" fill="var(--s-on-surface-variant)">{points[last].label}</text>
    </svg>
  );
}

/** GitHub-style consistency grid: weeks as columns, Monday first. `counts` maps YYYY-MM-DD -> sessions. */
export function ConsistencyGrid({ counts, weeks }: { counts: Record<string, number>; weeks: number }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const cells = Array.from({ length: weeks * 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    return { key, count: counts[key] ?? 0, future: day > today };
  });
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} role="img" aria-label="Consistency">
      {cells.map((cell, index) => (
        <motion.span
          key={cell.key}
          title={cell.key}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: cell.future ? 0.25 : 1, scale: 1 }}
          transition={{ ...spatial.fast, delay: Math.min(0.6, index * 0.003) }}
          className={cn("aspect-square rounded-[4px]", cell.count ? "bg-[var(--s-primary)]" : "bg-[var(--s-surface-container-highest)]")}
          style={cell.count ? { opacity: cell.future ? 0.25 : Math.min(1, 0.45 + cell.count * 0.3) } : undefined}
        />
      ))}
    </div>
  );
}
