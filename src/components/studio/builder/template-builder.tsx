"use client";

import { AnimatePresence, motion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen, Plus, Redo2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Locale } from "@/i18n/config";
import { getStudioCopy } from "@/i18n/studio-messages";
import { ApiError, createExerciseIfMissing, fetchExercise, useSaveTemplate } from "@/lib/studio/api";
import { ToolError } from "@/lib/webmcp/model-context";
import { useWebMcpTools } from "@/lib/webmcp/use-webmcp";
import type { ExerciseSummary } from "@/lib/studio/types";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { StudioButton } from "../ds/primitives";
import { agentStore } from "../agent/agent-store";
import { builderTools } from "../agent/builder-tools";
import { useReportDirty } from "../unsaved-guard";
import { toTemplateInput, type BuilderDoc } from "./builder-state";
import { createBuilderStore, useBuilderState } from "./builder-store";
import { CanvasPanel } from "./canvas-panel";
import { CatalogPanel } from "./catalog-panel";
import { InspectorPanel } from "./inspector-panel";
import { useCatalogPreference } from "./catalog-pref";
import { ExerciseDetail } from "./exercise-detail";
import { TemplatesNav } from "./templates-nav";

type Pane = "catalog" | "canvas" | "summary";
const DRAFT_KEY = "studio:template-draft:new";

function readDraft(): BuilderDoc | undefined {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as BuilderDoc) : undefined;
  } catch { return undefined; }
}

export function TemplateBuilder({ locale, templateId, initialDoc }: { locale: Locale; templateId?: string; initialDoc?: BuilderDoc }) {
  const copy = getStudioCopy(locale);
  const router = useRouter();
  const [store] = useState(() => createBuilderStore(initialDoc));
  const state = useBuilderState(store);
  const { dispatch } = store;
  const [pane, setPane] = useState<Pane>("canvas");
  const searchRef = useRef<HTMLInputElement>(null);
  // Wide screens: the catalog is mostly needed while composing, so an existing template starts with it folded away
  // until the person chooses otherwise (the choice is remembered).
  const [catalogPref, setCatalogPref] = useCatalogPreference();
  const catalogOpen = catalogPref ?? !initialDoc?.items.length;
  const [detail, setDetail] = useState<{ exercise: ExerciseSummary; coachNote?: string; fromCatalog: boolean } | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const save = useSaveTemplate();
  const { present: doc } = state;
  useReportDirty(state.dirty);

  // A new template restores its unsaved draft; an existing one always starts from the server copy.
  useEffect(() => {
    if (templateId) return;
    const draft = readDraft();
    if (draft?.items.length || draft?.name) dispatch({ type: "load", doc: draft });
  }, [templateId, dispatch]);

  useEffect(() => {
    if (templateId || !state.dirty) return;
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(doc)); } catch { /* storage may be unavailable */ }
  }, [doc, state.dirty, templateId]);

  const add = useCallback((exercise: ExerciseSummary) => {
    dispatch({ type: "add", exercise, key: crypto.randomUUID() });
    setPane("canvas");
  }, [dispatch]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") { event.preventDefault(); setPane("catalog"); setCatalogPref(true); setTimeout(() => searchRef.current?.focus(), 0); }
      else if (meta && event.key.toLowerCase() === "z" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable))) { event.preventDefault(); dispatch({ type: event.shiftKey ? "redo" : "undo" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, setCatalogPref]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);

  // Shared by the Save button and the agent's builder_save: validates the live draft, stores it, then updates the UI.
  const { mutateAsync: saveTemplate } = save;
  const persistDraft = useCallback(async () => {
    const draft = store.getState().present;
    if (!draft.name.trim()) throw new ToolError("name_required", copy.builder.nameRequired);
    if (!draft.items.length) throw new ToolError("exercises_required", copy.builder.exercisesRequired);
    let saved;
    try {
      saved = await saveTemplate({ id: templateId, input: toTemplateInput(draft, templateId) });
    } catch (error) {
      throw new ToolError(error instanceof ApiError ? error.code : "save_failed", error instanceof ApiError && error.code === "unknown_exercise" ? copy.builder.unknownExercise : copy.builder.saveFailed);
    }
    dispatch({ type: "saved" });
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    toast.success(copy.common.saved);
    if (!templateId) router.replace(`/${locale}/studio/templates/${saved.id}`);
    return saved;
  }, [store, saveTemplate, templateId, copy, dispatch, router, locale]);

  async function onSave() {
    try {
      await persistDraft();
    } catch (error) {
      toast.error(error instanceof ToolError ? error.message : copy.builder.saveFailed);
    }
  }

  // The copilot drives this same store through WebMCP while the builder is open.
  const agentTools = useMemo(() => builderTools({
    store,
    copy,
    save: persistDraft,
    fetchExercise,
    createExercise: (input) => createExerciseIfMissing({ name: input.name, primaryMuscles: [input.primaryMuscle], equipment: input.equipment }),
    allowSave: () => agentStore.getState().allowSave
  }), [store, copy, persistDraft]);
  useWebMcpTools(agentTools);

  const panes: Array<[Pane, string]> = [["catalog", copy.builder.catalog], ["canvas", doc.name || copy.templates.title], ["summary", copy.builder.summary]];

  return (
    <div className="mx-auto flex h-[calc(100dvh-2rem)] max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
      <TemplatesNav locale={locale} copy={copy} templateId={templateId} />
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={doc.name}
            onChange={(event) => dispatch({ type: "rename", name: event.target.value })}
            placeholder={copy.builder.namePlaceholder}
            aria-label={copy.builder.namePlaceholder}
            maxLength={120}
            className="s-serif w-full bg-transparent text-3xl tracking-tight outline-none placeholder:text-[var(--s-on-surface-variant)]/50 md:text-4xl"
          />
          <AnimatePresence>
            {state.dirty ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spatial.default} className="s-eyebrow overflow-hidden">{copy.builder.unsaved}</motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1">
          <StudioButton variant="ghost" size="sm" aria-label={copy.common.undo} disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}><Undo2 className="size-4" /></StudioButton>
          <StudioButton variant="ghost" size="sm" aria-label={copy.common.redo} disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}><Redo2 className="size-4" /></StudioButton>
        </div>
        <StudioButton onClick={onSave} disabled={save.isPending} className="min-w-32">{save.isPending ? copy.common.saving : copy.common.save}</StudioButton>
      </header>

      <div role="tablist" className="flex gap-1 rounded-full bg-[var(--s-surface-container)] p-1 lg:hidden">
        {panes.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={pane === id} onClick={() => setPane(id)} className="relative flex-1 truncate rounded-full px-3 py-2 text-[13px] font-semibold outline-none">
            {pane === id ? <motion.span layoutId="studio-pane" transition={spatial.default} className="absolute inset-0 rounded-full bg-[var(--s-primary)]" /> : null}
            <span className={cn("relative", pane === id ? "text-[var(--s-on-primary)]" : "text-[var(--s-on-surface-variant)]")}>{label}</span>
          </button>
        ))}
      </div>

      <div className={cn("grid min-h-0 flex-1 gap-5 transition-[grid-template-columns] duration-300", catalogOpen ? "lg:grid-cols-[340px_minmax(0,1fr)_320px]" : "lg:grid-cols-[56px_minmax(0,1fr)_320px]")}>
        <section aria-label={copy.builder.catalog} data-catalog-open={catalogOpen} className={cn("min-h-0 flex-col", pane === "catalog" ? "flex" : "hidden lg:flex")}>
          {catalogOpen ? (
            <div className="mb-2 hidden justify-end lg:flex">
              <button type="button" aria-label={copy.builder.collapseCatalog} title={copy.builder.collapseCatalog} onClick={() => setCatalogPref(false)} className="grid size-9 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                <PanelLeftClose className="size-4" />
              </button>
            </div>
          ) : (
            <div className="hidden flex-col items-center gap-2 lg:flex">
              <button type="button" aria-label={copy.builder.expandCatalog} title={`${copy.builder.expandCatalog}  ⌘K`} onClick={() => { setCatalogPref(true); setTimeout(() => searchRef.current?.focus(), 0); }} className="grid size-11 place-items-center rounded-full bg-[var(--s-primary-container)] text-[var(--s-on-primary-container)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                <PanelLeftOpen className="size-5" />
              </button>
              <button type="button" aria-label={copy.builder.add} onClick={() => setCatalogPref(true)} className="grid size-11 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                <Plus className="size-5" />
              </button>
            </div>
          )}
          <div className={cn("min-h-0 flex-1 flex-col", catalogOpen ? "flex" : "flex lg:hidden")}>
            <CatalogPanel copy={copy} onAdd={add} onOpenDetail={(exercise) => setDetail({ exercise, fromCatalog: true })} searchRef={searchRef} />
          </div>
        </section>
        <section aria-label={doc.name || copy.templates.title} className={cn("min-h-0 overflow-y-auto pb-24 pr-1", pane === "canvas" ? "block" : "hidden lg:block")}>
          <CanvasPanel items={doc.items} copy={copy} dispatch={dispatch} onOpenDetail={(exercise, coachNote) => setDetail({ exercise, coachNote, fromCatalog: false })} onDropExercise={(exercise, index) => dispatch({ type: "add", exercise, key: crypto.randomUUID(), index })} />
        </section>
        <section aria-label={copy.builder.summary} className={cn("min-h-0 overflow-y-auto pb-6", pane === "summary" ? "block" : "hidden lg:block")}>
          <InspectorPanel items={doc.items} copy={copy} />
        </section>
      </div>

      <AnimatePresence>
        {detail ? <ExerciseDetail key={detail.exercise.id} exercise={detail.exercise} copy={copy} coachNote={detail.coachNote} onClose={closeDetail} onAdd={detail.fromCatalog ? add : undefined} /> : null}
      </AnimatePresence>
    </div>
  );
}
