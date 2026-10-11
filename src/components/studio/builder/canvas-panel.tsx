"use client";

import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { GripVertical, Link2, Link2Off, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent, type Dispatch } from "react";
import { muscleLabel, type StudioCopy } from "@/i18n/studio-messages";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { Eyebrow, Stepper, Surface } from "../ds/primitives";
import type { ExerciseSummary } from "@/lib/studio/types";
import { useAgentState } from "../agent/agent-store";
import type { BuilderAction, BuilderItem } from "./builder-state";
import { DropIndicator } from "./drop-indicator";
import { hasDraggedExercise, insertionIndex, readDraggedExercise } from "./drag";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--s-on-surface-variant)]">{label}</div>
      {children}
    </div>
  );
}

type OpenDetail = (exercise: ExerciseSummary, coachNote?: string) => void;

function ExerciseCard({ item, index, items, copy, dispatch, onOpenDetail }: { item: BuilderItem; index: number; items: BuilderItem[]; copy: StudioCopy; dispatch: Dispatch<BuilderAction>; onOpenDetail?: OpenDetail }) {
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
  const touched = useAgentState().touched;
  const agentTouched = touched?.key === item.key ? touched.at : null;

  return (
    <Reorder.Item
      value={item.key}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      data-card
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
      {agentTouched ? (
        <motion.div
          key={agentTouched}
          aria-hidden
          data-testid="agent-highlight"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-10 rounded-[var(--s-radius-xl)] shadow-[0_0_0_2px_var(--s-primary),0_0_44px_6px_var(--s-glow)]"
        />
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
          <button
            type="button"
            aria-label={`${copy.builder.openDetail}: ${item.exercise.name}`}
            title={copy.builder.openDetail}
            onClick={() => onOpenDetail?.(item.exercise, item.note)}
            className="relative size-[72px] shrink-0 cursor-zoom-in overflow-hidden rounded-[var(--s-radius-sm)] bg-[var(--s-surface-container-highest)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog frame */}
            {photo ? <img src={photo} alt="" className="size-full object-cover" /> : null}
          </button>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[17px] font-semibold leading-snug">{item.exercise.name}</div>
            <div className="truncate text-[12px] text-[var(--s-on-surface-variant)]">{muscles}</div>
          </div>
          <span className="s-eyebrow hidden sm:block">{index + 1}</span>
          <button type="button" aria-label={`${copy.builder.remove}: ${item.exercise.name}`} onClick={() => dispatch({ type: "remove", key: item.key })} className="grid size-9 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--s-error)_14%,transparent)] hover:text-[var(--s-error)] focus-visible:ring-2 focus-visible:ring-[var(--s-error)]">
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-6">
          <Field label={copy.builder.sets}><Stepper label={copy.builder.sets} value={item.sets} min={1} max={20} onChange={(sets) => patch({ sets: sets ?? item.sets })} /></Field>
          <Field label={copy.builder.weight}><Stepper label={copy.builder.weight} value={item.weightKg} min={0} max={1000} step={2.5} suffix={copy.common.kg} optional onChange={(weightKg) => patch({ weightKg })} /></Field>
          <Field label={copy.builder.repMin}><Stepper label={copy.builder.repMin} value={item.repMin} min={1} max={100} optional onChange={(repMin) => patch({ repMin })} /></Field>
          <Field label={copy.builder.repMax}><Stepper label={copy.builder.repMax} value={item.repMax} min={1} max={100} optional onChange={(repMax) => patch({ repMax })} /></Field>
          <Field label={copy.builder.rir}><Stepper label={copy.builder.rir} value={item.targetRir} min={0} max={5} optional onChange={(targetRir) => patch({ targetRir })} /></Field>
          <Field label={copy.builder.progression}><Stepper label={copy.builder.progression} value={item.progressionKg} min={0} max={50} step={0.5} optional onChange={(progressionKg) => patch({ progressionKg: progressionKg || undefined })} /></Field>
        </div>

        <div className="mt-3">
          <Field label={copy.builder.coachNote}>
            <textarea
              value={item.note ?? ""}
              onChange={(event) => patch({ note: event.target.value })}
              placeholder={copy.builder.note}
              aria-label={copy.builder.coachNote}
              maxLength={500}
              rows={item.note && item.note.length > 70 ? 3 : 1}
              className="w-full resize-y rounded-[var(--s-radius-sm)] bg-transparent px-3 py-2 text-sm outline-none ring-1 ring-[var(--s-outline-variant)] transition-shadow placeholder:text-[var(--s-on-surface-variant)] focus:ring-2 focus:ring-[var(--s-primary)]"
            />
          </Field>
        </div>
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

export function CanvasPanel({ items, copy, dispatch, onDropExercise, onOpenDetail }: { items: BuilderItem[]; copy: StudioCopy; dispatch: Dispatch<BuilderAction>; onDropExercise?: (exercise: ExerciseSummary, index: number) => void; onOpenDetail?: OpenDetail }) {
  const container = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<{ index: number; y: number } | null>(null);

  function locate(clientY: number) {
    const root = container.current;
    if (!root) return { index: items.length, y: 0 };
    const rects = Array.from(root.querySelectorAll<HTMLElement>("[data-card]")).map((node) => node.getBoundingClientRect());
    const index = insertionIndex(rects, clientY);
    const base = root.getBoundingClientRect().top;
    const y = rects.length === 0 ? 0 : index < rects.length ? rects[index].top - base - 6 : rects[rects.length - 1].bottom - base + 6;
    return { index, y };
  }

  const dropProps = onDropExercise ? {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedExercise(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDrop(locate(event.clientY));
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      const exercise = readDraggedExercise(event.dataTransfer);
      if (!exercise) return;
      event.preventDefault();
      const at = locate(event.clientY).index;
      setDrop(null);
      onDropExercise(exercise, at);
    }
  } : {};

  return (
    <div ref={container} className="relative min-h-[320px]" {...dropProps}>
      {!items.length ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={spatial.slow} className={cn("grid min-h-[320px] place-items-center rounded-[var(--s-radius-xl)] border border-dashed p-10 text-center transition-colors", drop ? "border-[var(--s-primary)] bg-[var(--s-primary-container)]" : "border-[var(--s-outline-variant)]")}>
          <div>
            <div className="s-serif text-2xl">{drop ? copy.builder.dropHere : copy.builder.canvasEmpty}</div>
            <Eyebrow className="mt-2">{copy.builder.canvasEmptyHint}</Eyebrow>
          </div>
        </motion.div>
      ) : (
        <Reorder.Group axis="y" values={items.map((item) => item.key)} onReorder={(keys) => dispatch({ type: "reorder", keys })} className="m-0 p-0">
          <AnimatePresence initial={false}>
            {items.map((item, index) => <ExerciseCard key={item.key} item={item} index={index} items={items} copy={copy} dispatch={dispatch} onOpenDetail={onOpenDetail} />)}
          </AnimatePresence>
        </Reorder.Group>
      )}
      <AnimatePresence>{drop && items.length ? <DropIndicator y={drop.y} label={copy.builder.dropHere} /> : null}</AnimatePresence>
    </div>
  );
}
