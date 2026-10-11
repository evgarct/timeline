"use client";

import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { youtubeVideoId } from "@/domain/youtube";
import { muscleLabel, type StudioCopy } from "@/i18n/studio-messages";
import { useSetExerciseVideo } from "@/lib/studio/api";
import type { ExerciseSummary } from "@/lib/studio/types";
import { spatial } from "@/lib/motion/tokens";
import { Eyebrow, StudioButton } from "../ds/primitives";
import { MuscleMap } from "../ds/muscle-map";
import { YoutubePlayer } from "./youtube-player";

function VideoField({ exercise, copy, onSaved }: { exercise: ExerciseSummary; copy: StudioCopy; onSaved: (url: string) => void }) {
  const [value, setValue] = useState(exercise.videoUrl ?? "");
  const save = useSetExerciseVideo();
  const valid = Boolean(youtubeVideoId(value));
  const unchanged = value.trim() === (exercise.videoUrl ?? "");

  function submit() {
    if (!valid) { toast.error(copy.builder.videoInvalid); return; }
    save.mutate({ id: exercise.id, name: exercise.name, videoUrl: value.trim(), isArchived: exercise.isArchived }, {
      onSuccess: (saved) => { toast.success(copy.builder.videoSaved); onSaved(saved.videoUrl ?? value.trim()); },
      onError: () => toast.error(copy.builder.videoFailed)
    });
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="url"
        placeholder="https://youtu.be/…"
        aria-label={copy.builder.videoLink}
        aria-invalid={Boolean(value) && !valid}
        className="h-10 min-w-0 flex-1 rounded-[var(--s-radius-sm)] bg-transparent px-3 text-sm outline-none ring-1 ring-[var(--s-outline-variant)] transition-shadow placeholder:text-[var(--s-on-surface-variant)] focus:ring-2 focus:ring-[var(--s-primary)] aria-[invalid=true]:ring-[var(--s-error)]"
      />
      <StudioButton type="submit" size="sm" disabled={save.isPending || unchanged || !value.trim()}>{copy.builder.videoSave}</StudioButton>
    </form>
  );
}

/**
 * Everything that tells the lifter what an exercise is: both photo frames at a readable size, the muscles it trains,
 * the technique, the trainer's note for this program and the how-to video (played in place, click-to-load).
 */
export function ExerciseDetail({ exercise, copy, coachNote, onClose, onAdd }: {
  exercise: ExerciseSummary;
  copy: StudioCopy;
  /** The note written for this exercise in the template being edited, if opened from the canvas. */
  coachNote?: string;
  onClose: () => void;
  onAdd?: (exercise: ExerciseSummary) => void;
}) {
  // A link saved from this dialog replaces the catalog copy until the list refetches.
  const [savedVideo, setSavedVideo] = useState<string>();
  const videoUrl = savedVideo ?? exercise.videoUrl;
  const primary = exercise.primaryMuscles ?? exercise.muscleGroups ?? [];
  const secondary = exercise.secondaryMuscles ?? [];
  const steps = exercise.instructions ?? [];
  // Radix portals to <body> by default, which is outside the Studio token scope: mount it inside the scoped surface.
  const [container] = useState(() => document.querySelector<HTMLElement>('[data-surface="studio"]') ?? document.body);

  const intensity: Record<string, number> = {};
  for (const muscle of secondary) intensity[muscle] = 0.5;
  for (const muscle of primary) intensity[muscle] = 1;

  // The shared Radix dialog supplies the focus trap, background isolation, Escape and focus restoration.
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay asChild>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spatial.fast} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-end outline-none sm:place-items-center sm:p-6"
        >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spatial.default}
        className="pointer-events-auto flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[var(--s-radius-sheet)] bg-[var(--s-surface)] text-[var(--s-on-background)] shadow-[0_30px_80px_-20px_var(--s-glow)] sm:rounded-[var(--s-radius-sheet)]"
      >
        <header className="flex items-start gap-3 px-6 pb-3 pt-5">
          <div className="min-w-0 flex-1">
            <Eyebrow>{[...primary.map((muscle) => muscleLabel(copy, muscle)), exercise.equipment].filter(Boolean).join(" · ")}</Eyebrow>
            <DialogPrimitive.Title className="s-serif mt-1 text-3xl leading-tight tracking-tight">{exercise.name}</DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Close aria-label={copy.builder.closeDetail} className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
            <X className="size-5" />
          </DialogPrimitive.Close>
        </header>

        <div className="space-y-6 overflow-y-auto px-6 pb-6">
          {exercise.images?.length ? (
            <div className="grid grid-cols-2 gap-3" data-testid="detail-photos">
              {exercise.images.slice(0, 2).map((src) => (
                <div key={src} className="aspect-[4/3] overflow-hidden rounded-[var(--s-radius-lg)] bg-[var(--s-surface-container-highest)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog frame */}
                  <img src={src} alt={exercise.name} className="size-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}

          {coachNote ? (
            <section aria-label={copy.builder.coachNote} className="rounded-[var(--s-radius-lg)] bg-[var(--s-primary-container)] p-4 text-[var(--s-on-primary-container)]">
              <Eyebrow className="text-[inherit] opacity-70">{copy.builder.coachNote}</Eyebrow>
              <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{coachNote}</p>
            </section>
          ) : null}

          {videoUrl ? (
            <section aria-label={copy.builder.videoTitle} className="space-y-2">
              <Eyebrow>{copy.builder.videoTitle}</Eyebrow>
              <YoutubePlayer key={videoUrl} url={videoUrl} title={exercise.name} playLabel={copy.builder.videoPlay} />
            </section>
          ) : null}

          <section aria-label={copy.builder.instructions} className="space-y-3">
            <Eyebrow>{copy.builder.instructions}</Eyebrow>
            {steps.length ? (
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="s-num mt-0.5 w-5 shrink-0 font-semibold text-[var(--s-primary)]">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[var(--s-on-surface-variant)]">{copy.builder.noTechnique}</p>
            )}
          </section>

          <section aria-label={copy.builder.muscle} className="flex items-center gap-6">
            <MuscleMap intensity={intensity} className="h-44 shrink-0" />
            <dl className="min-w-0 space-y-3 text-sm">
              <div>
                <dt className="s-eyebrow">{copy.builder.primaryMuscles}</dt>
                <dd className="mt-0.5">{primary.map((muscle) => muscleLabel(copy, muscle)).join(" · ") || "—"}</dd>
              </div>
              {secondary.length ? (
                <div>
                  <dt className="s-eyebrow">{copy.builder.secondaryMuscles}</dt>
                  <dd className="mt-0.5">{secondary.map((muscle) => muscleLabel(copy, muscle)).join(" · ")}</dd>
                </div>
              ) : null}
              {exercise.movementPattern ? (
                <div>
                  <dt className="s-eyebrow">{copy.builder.pattern}</dt>
                  <dd className="mt-0.5">{exercise.movementPattern}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="space-y-2">
            <Eyebrow>{copy.builder.videoLink}</Eyebrow>
            <VideoField key={videoUrl ?? "none"} exercise={{ ...exercise, videoUrl }} copy={copy} onSaved={setSavedVideo} />
          </section>
        </div>

        {onAdd ? (
          <footer className="border-t border-[var(--s-outline-variant)] px-6 py-4">
            <StudioButton className="w-full" onClick={() => { onAdd(exercise); onClose(); }}><Plus className="size-4" />{copy.builder.addToTemplate}</StudioButton>
          </footer>
        ) : null}
      </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
