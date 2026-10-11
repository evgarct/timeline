"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { muscleLabel, type StudioCopy } from "@/i18n/studio-messages";
import { spatial } from "@/lib/motion/tokens";
import { Eyebrow, NumberTicker, SerifNumber, Surface } from "../ds/primitives";
import { MuscleMap } from "../ds/muscle-map";
import { muscleSets, type BuilderItem } from "./builder-state";

export function InspectorPanel({ items, copy }: { items: BuilderItem[]; copy: StudioCopy }) {
  const totals = useMemo(() => Object.entries(muscleSets(items)).sort((a, b) => b[1] - a[1]), [items]);
  const primary = useMemo(() => [...new Set(items.flatMap((item) => (item.exercise.primaryMuscles?.length ? item.exercise.primaryMuscles : item.exercise.muscleGroups ?? [])))], [items]);
  const secondary = useMemo(() => [...new Set(items.flatMap((item) => item.exercise.secondaryMuscles ?? []))].filter((muscle) => !primary.includes(muscle)), [items, primary]);
  const totalSets = items.reduce((sum, item) => sum + item.sets, 0);
  const max = Math.max(1, ...totals.map(([, value]) => value));

  return (
    <div className="space-y-4">
      <Surface tone="primary" className="p-5">
        <Eyebrow>{copy.builder.totalSets}</Eyebrow>
        <div className="mt-1 flex items-end justify-between">
          <SerifNumber size={48} value={<NumberTicker value={totalSets} />} />
          <div className="pb-1 text-right text-[13px] text-[var(--s-on-surface-variant)]">{items.length} {copy.common.exercises}</div>
        </div>
      </Surface>

      <Surface className="h-[300px] p-4">
        <MuscleMap primary={primary} secondary={secondary} />
      </Surface>

      <Surface className="p-5">
        <Eyebrow>{copy.builder.musclesTitle}</Eyebrow>
        <ul className="mt-3 space-y-3">
          {totals.map(([muscle, value]) => (
            <li key={muscle}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span>{muscleLabel(copy, muscle)}</span>
                <span className="s-num font-semibold">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--s-surface-container-highest)]">
                <motion.div className="h-full origin-left rounded-full bg-[var(--s-primary)]" initial={false} animate={{ width: `${(value / max) * 100}%` }} transition={spatial.default} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] text-[var(--s-on-surface-variant)]">{copy.builder.secondaryHint}</p>
      </Surface>
    </div>
  );
}
