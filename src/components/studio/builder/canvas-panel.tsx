"use client";

import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { GripVertical, Link2, Link2Off, Trash2 } from "lucide-react";
import { useState, type Dispatch } from "react";
import { muscleLabel, type StudioCopy } from "@/i18n/studio-messages";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { Eyebrow, Stepper, Surface } from "../ds/primitives";
import type { BuilderAction, BuilderItem } from "./builder-state";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--s-on-surface-variant)]">{label}</div>
      {children}
    </div>
  );
}

function ExerciseCard({ item, index, items, copy, dispatch }: { item: BuilderItem; index: number; items: BuilderItem[]; copy: StudioCopy; dispatch: Dispatch<BuilderAction> }) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const next = items[index + 1];
  const prev = items[index - 1];
  const inGroup = Boolean(item.groupId);
  const joinsPrev = inGroup && prev?.groupId === item.groupId;
  const joinsNext = inGroup && next?.groupId === item.groupId;
  const linked = joinsNext;
  const patch = (value: Partial<BuilderItem>) => dispatch({ type: "patch", key: item.key, patch: value });
  const muscles = (item.exercise.primaryMuscles ?? item.exercise.muscleGroups ?? []).map((muscle) => muscleLabel(copy, muscle)).join(" · ");
  const photo = item.exercise.images?.[0];

  return (
    <Reorder.Item
      value={item.key}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      layout="position"
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: dragging ? 1.02 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, height: 0, marginBottom: 0 }}
      transition={spatial.default}
      whileDrag={{ zIndex: 10 }}
      className={cn("relative list-none", joinsNext ? "mb-1" : "mb-3")}
    >
      {inGroup && !joinsPrev ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spatial.fast} className="ml-5 inline-flex rounded-t-[14px] bg-[var(--s-primary)] px-3 py-1 text-[13px] font-semibold text-[var(--s-on-primary)]">
          {item.groupLabel ?? copy.builder.superset}
        </motion.div>
      ) : null}
      <Surface
        tone={inGroup ? "high" : "container"}
        className={cn(
          "@container p-4 transition-shadow",
          dragging && "shadow-[0_24px_60px_-20px_var(--s-glow)]",
          inGroup && "border-l-4 border-l-[var(--s-primary)]",
          joinsPrev && "rounded-t-[8px]",
          joinsNext && "rounded-b-[8px]"
        )}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={copy.builder.dragHint}
            onPointerDown={(event) => controls.start(event)}
            className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container-high)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)] active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--s-radius-sm)] bg-[var(--s-surface-container-highest)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog frame */}
            {photo ? <img src={photo} alt="" className="size-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold">{item.exercise.name}</div>
            <div className="truncate text-[12px] text-[var(--s-on-surface-variant)]">{muscles}</div>
          </div>
          <span className="s-eyebrow hidden sm:block">{index + 1}</span>
          <button type="button" aria-label={`${copy.builder.remove}: ${item.exercise.name}`} onClick={() => dispatch({ type: "remove", key: item.key })} className="grid size-9 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--s-error)_14%,transparent)] hover:text-[var(--s-error)] focus-visible:ring-2 focus-visible:ring-[var(--s-error)]">
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-6">
          <Field label={copy.builder.sets}><Stepper label={copy.builder.sets} value={item.sets} min={1} max={20} onChange={(sets) => patch({ sets })} /></Field>
          <Field label={copy.builder.weight}><Stepper label={copy.builder.weight} value={item.weightKg} min={0} max={1000} step={2.5} suffix={copy.common.kg} onChange={(weightKg) => patch({ weightKg: weightKg || undefined })} /></Field>
          <Field label={copy.builder.repMin}><Stepper label={copy.builder.repMin} value={item.repMin} min={1} max={100} onChange={(repMin) => patch({ repMin })} /></Field>
          <Field label={copy.builder.repMax}><Stepper label={copy.builder.repMax} value={item.repMax} min={1} max={100} onChange={(repMax) => patch({ repMax })} /></Field>
          <Field label={copy.builder.rir}><Stepper label={copy.builder.rir} value={item.targetRir} min={0} max={5} onChange={(targetRir) => patch({ targetRir })} /></Field>
          <Field label={copy.builder.progression}><Stepper label={copy.builder.progression} value={item.progressionKg} min={0} max={50} step={0.5} onChange={(progressionKg) => patch({ progressionKg: progressionKg || undefined })} /></Field>
        </div>

        <input
          value={item.note ?? ""}
          onChange={(event) => patch({ note: event.target.value })}
          placeholder={copy.builder.note}
          aria-label={copy.builder.note}
          maxLength={500}
          className="mt-3 h-10 w-full rounded-[var(--s-radius-sm)] bg-transparent px-3 text-sm outline-none ring-1 ring-[var(--s-outline-variant)] transition-shadow placeholder:text-[var(--s-on-surface-variant)] focus:ring-2 focus:ring-[var(--s-primary)]"
        />
      </Surface>

      {next ? (
        <div className="relative z-[1] -my-2 flex justify-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            transition={spatial.fast}
            onClick={() => dispatch({ type: "toggleSuperset", key: item.key, groupId: crypto.randomUUID().slice(0, 8) })}
            aria-label={linked ? copy.builder.unlink : copy.builder.linkNext}
            title={linked ? copy.builder.unlink : copy.builder.linkNext}
            className={cn(
              "grid size-7 place-items-center rounded-full border border-[var(--s-outline-variant)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]",
              linked ? "bg-[var(--s-primary)] text-[var(--s-on-primary)]" : "bg-[var(--s-surface)] text-[var(--s-on-surface-variant)] hover:text-[var(--s-primary)]"
            )}
          >
            {linked ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
          </motion.button>
        </div>
      ) : null}
    </Reorder.Item>
  );
}

export function CanvasPanel({ items, copy, dispatch }: { items: BuilderItem[]; copy: StudioCopy; dispatch: Dispatch<BuilderAction> }) {
  if (!items.length) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={spatial.slow} className="grid min-h-[320px] place-items-center rounded-[var(--s-radius-xl)] border border-dashed border-[var(--s-outline-variant)] p-10 text-center">
        <div>
          <div className="s-serif text-2xl">{copy.builder.canvasEmpty}</div>
          <Eyebrow className="mt-2">{copy.builder.canvasEmptyHint}</Eyebrow>
        </div>
      </motion.div>
    );
  }
  return (
    <Reorder.Group axis="y" values={items.map((item) => item.key)} onReorder={(keys) => dispatch({ type: "reorder", keys })} className="m-0 p-0">
      <AnimatePresence initial={false}>
        {items.map((item, index) => <ExerciseCard key={item.key} item={item} index={index} items={items} copy={copy} dispatch={dispatch} />)}
      </AnimatePresence>
    </Reorder.Group>
  );
}
