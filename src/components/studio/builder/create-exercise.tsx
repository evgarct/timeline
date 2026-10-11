"use client";

import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { muscleLabel, type StudioCopy } from "@/i18n/studio-messages";
import type { ExerciseFacet } from "@/lib/studio/types";
import { spatial } from "@/lib/motion/tokens";
import { Chip, Eyebrow, StudioButton } from "../ds/primitives";

export interface NewExercise { name: string; primaryMuscle: string; equipment?: string }

/** Every muscle a new exercise can target. Ones the catalog already uses come first, so a rarely used muscle is never hidden. */
const allMuscles = ["chest", "lats", "upper back", "lower back", "shoulders", "traps", "biceps", "triceps", "forearms", "abs", "obliques", "quads", "hamstrings", "glutes", "calves", "adductors", "abductors"];

/** Inline "create exercise" form shown in the catalog when a search has no exact match. */
export function CreateExerciseForm({ copy, defaultName, muscles, equipment, pending, onSubmit, onCancel }: {
  copy: StudioCopy;
  defaultName: string;
  muscles: ExerciseFacet[];
  equipment: ExerciseFacet[];
  pending?: boolean;
  onSubmit: (exercise: NewExercise) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [muscle, setMuscle] = useState<string>();
  const [gear, setGear] = useState<string>();
  const used = muscles.map((facet) => facet.value).filter((value) => allMuscles.includes(value));
  const options = [...used, ...allMuscles.filter((value) => !used.includes(value))];
  const valid = name.trim().length > 0 && Boolean(muscle);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid && muscle) onSubmit({ name: name.trim(), primaryMuscle: muscle, equipment: gear });
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={spatial.default}
      aria-label={copy.builder.newExercise}
      className="overflow-hidden rounded-[var(--s-radius-lg)] bg-[var(--s-primary-container)]"
    >
      <div className="space-y-3 p-4">
        <Eyebrow>{copy.builder.newExercise}</Eyebrow>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={copy.builder.exerciseName}
          maxLength={120}
          className="h-11 w-full rounded-[var(--s-radius-sm)] bg-[var(--s-surface)] px-3 text-base outline-none focus:shadow-[0_0_0_2px_var(--s-primary)]"
        />
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--s-on-surface-variant)]">{copy.builder.primaryMuscle}</div>
          <div className="flex flex-wrap gap-1.5">
            {options.map((value) => <Chip key={value} groupId="new-muscle" active={muscle === value} onClick={() => setMuscle(value)}>{muscleLabel(copy, value)}</Chip>)}
          </div>
        </div>
        {equipment.length ? (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--s-on-surface-variant)]">{copy.builder.equipment}</div>
            <div className="flex flex-wrap gap-1.5">
              {equipment.slice(0, 8).map((facet) => <Chip key={facet.value} groupId="new-equipment" active={gear === facet.value} onClick={() => setGear(gear === facet.value ? undefined : facet.value)}>{facet.value}</Chip>)}
            </div>
          </div>
        ) : null}
        <div className="flex gap-2 pt-1">
          <StudioButton type="submit" size="sm" disabled={!valid || pending}>{pending ? copy.builder.creating : copy.builder.create}</StudioButton>
          <StudioButton variant="ghost" size="sm" onClick={onCancel}>{copy.common.cancel}</StudioButton>
        </div>
      </div>
    </motion.form>
  );
}
