"use client";

import { AnimatePresence, motion } from "motion/react";
import { Play, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { useCreateExercise, useExerciseCatalog, useExerciseFacets, type CatalogFilter } from "@/lib/studio/api";
import type { ExerciseFacet, ExerciseSummary } from "@/lib/studio/types";
import { muscleLabel, type StudioCopy } from "@/i18n/studio-messages";
import { effects, spatial } from "@/lib/motion/tokens";
import { Chip, Eyebrow, Surface } from "../ds/primitives";
import { CreateExerciseForm, type NewExercise } from "./create-exercise";
import { writeDraggedExercise } from "./drag";

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function FacetRow({ id, label, facets, value, onChange, format }: { id: string; label: string; facets: ExerciseFacet[]; value?: string; onChange: (next?: string) => void; format?: (value: string) => string }) {
  if (!facets.length) return null;
  return (
    <div className="space-y-1.5">
      <Eyebrow>{label}</Eyebrow>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {facets.slice(0, 12).map((facet) => (
          <Chip key={facet.value} groupId={id} active={value === facet.value} count={facet.count} onClick={() => onChange(value === facet.value ? undefined : facet.value)}>
            {format ? format(facet.value) : facet.value}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function ExerciseTile({ exercise, copy, onAdd, onOpenDetail }: { exercise: ExerciseSummary; copy: StudioCopy; onAdd: (exercise: ExerciseSummary) => void; onOpenDetail: (exercise: ExerciseSummary) => void }) {
  const [first, second] = exercise.images ?? [];
  const [hover, setHover] = useState(false);
  const muscles = (exercise.primaryMuscles ?? exercise.muscleGroups ?? []).map((muscle) => muscleLabel(copy, muscle)).join(" · ");
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spatial.default}>
      <div draggable onDragStart={(event) => writeDraggedExercise(event, exercise)} className="cursor-grab active:cursor-grabbing">
      <Surface
        tone="container"
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        className="group flex items-center gap-3 rounded-[var(--s-radius-lg)] p-2 pr-3 transition-shadow hover:shadow-[0_0_0_1px_var(--s-primary),0_12px_40px_-12px_var(--s-glow)]"
      >
        <button
          type="button"
          aria-label={`${copy.builder.openDetail}: ${exercise.name}`}
          title={copy.builder.openDetail}
          onClick={() => onOpenDetail(exercise)}
          className="relative size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-[var(--s-radius-sm)] bg-[var(--s-surface-container-highest)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"
        >
          {first ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- catalog photos are remote free-exercise-db frames */}
              <img src={first} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              {second ? (
                <motion.img src={second} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" initial={false} animate={{ opacity: hover ? 1 : 0 }} transition={effects.default} />
              ) : null}
            </>
          ) : null}
          {exercise.videoUrl ? <span aria-hidden className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"><Play className="ml-px size-2.5 fill-current" /></span> : null}
        </button>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${copy.builder.add}: ${exercise.name}`}
          onClick={() => onAdd(exercise)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onAdd(exercise); } }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--s-radius-sm)] py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"
        >
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[15px] font-semibold leading-snug">{exercise.name}</div>
            <div className="mt-0.5 truncate text-[12px] text-[var(--s-on-surface-variant)]">{[muscles, exercise.equipment].filter(Boolean).join(" · ")}</div>
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--s-primary-container)] text-[var(--s-on-primary-container)] transition-transform group-hover:scale-110"><Plus className="size-4" /></span>
        </div>
      </Surface>
      </div>
    </motion.li>
  );
}

export function CatalogPanel({ copy, onAdd, onOpenDetail, searchRef }: { copy: StudioCopy; onAdd: (exercise: ExerciseSummary) => void; onOpenDetail: (exercise: ExerciseSummary) => void; searchRef: RefObject<HTMLInputElement | null> }) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>();
  const [equipment, setEquipment] = useState<string>();
  const [movementPattern, setMovementPattern] = useState<string>();
  const debounced = useDebounced(query.trim(), 250);
  const filter = useMemo<CatalogFilter>(() => ({ query: debounced, muscle, equipment, movementPattern }), [debounced, muscle, equipment, movementPattern]);
  const catalog = useExerciseCatalog(filter);
  const facets = useExerciseFacets();
  const items = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const createExercise = useCreateExercise();
  const [creating, setCreating] = useState(false);
  const hasExactMatch = items.some((exercise) => exercise.name.toLowerCase() === debounced.toLowerCase());
  const canCreate = Boolean(debounced) && !catalog.isPending && !hasExactMatch;

  function create(input: NewExercise) {
    createExercise.mutate({ name: input.name, primaryMuscles: [input.primaryMuscle], equipment: input.equipment }, {
      onSuccess: (exercise) => { setCreating(false); setQuery(""); onAdd(exercise); },
      onError: () => toast.error(copy.builder.createFailed)
    });
  }

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = catalog;
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--s-on-surface-variant)]" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`${copy.builder.search}  ⌘K`}
          aria-label={copy.builder.search}
          className="h-12 w-full rounded-[var(--s-radius-md)] bg-[var(--s-surface-container-highest)] pl-10 pr-3 text-base outline-none transition-shadow placeholder:text-[var(--s-on-surface-variant)] focus:shadow-[0_0_0_2px_var(--s-primary)]"
        />
      </label>

      <div className="space-y-3">
        <FacetRow id="muscle" label={copy.builder.muscle} facets={facets.data?.muscles ?? []} value={muscle} onChange={setMuscle} format={(value) => muscleLabel(copy, value)} />
        <FacetRow id="equipment" label={copy.builder.equipment} facets={facets.data?.equipment ?? []} value={equipment} onChange={setEquipment} />
        <FacetRow id="pattern" label={copy.builder.pattern} facets={facets.data?.movementPatterns ?? []} value={movementPattern} onChange={setMovementPattern} />
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        <AnimatePresence initial={false}>
          {canCreate && !creating ? (
            <motion.button
              key="create-cta"
              type="button"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spatial.fast}
              onClick={() => setCreating(true)}
              className="mb-3 flex w-full items-center gap-3 rounded-[var(--s-radius-lg)] bg-[var(--s-primary-container)] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"
            >
              <span className="grid size-8 place-items-center rounded-full bg-[var(--s-primary)] text-[var(--s-on-primary)]"><Plus className="size-4" /></span>
              <span className="min-w-0 truncate text-[15px] font-semibold">{copy.builder.create} “{debounced}”</span>
            </motion.button>
          ) : null}
          {canCreate && creating ? (
            <div key="create-form" className="mb-3">
              <CreateExerciseForm copy={copy} defaultName={debounced} muscles={facets.data?.muscles ?? []} equipment={facets.data?.equipment ?? []} pending={createExercise.isPending} onSubmit={create} onCancel={() => setCreating(false)} />
            </div>
          ) : null}
        </AnimatePresence>
        {catalog.isPending ? (
          <ul className="space-y-2" aria-busy>{Array.from({ length: 6 }, (_, index) => <li key={index} className="h-24 animate-pulse rounded-[var(--s-radius-lg)] bg-[var(--s-surface-container)]" />)}</ul>
        ) : (
          <motion.ul layout className="space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((exercise) => <ExerciseTile key={exercise.id} exercise={exercise} copy={copy} onAdd={onAdd} onOpenDetail={onOpenDetail} />)}
            </AnimatePresence>
          </motion.ul>
        )}
        {!catalog.isPending && !items.length ? <p className="py-10 text-center text-sm text-[var(--s-on-surface-variant)]">{copy.builder.noResults}</p> : null}
        <div ref={sentinel} className="h-px" />
      </div>
    </div>
  );
}
