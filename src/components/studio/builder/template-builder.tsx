"use client";

import { AnimatePresence, motion } from "motion/react";
import { Redo2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import type { Locale } from "@/i18n/config";
import { getStudioCopy } from "@/i18n/studio-messages";
import { ApiError, useSaveTemplate } from "@/lib/studio/api";
import type { ExerciseSummary } from "@/lib/studio/types";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { StudioButton } from "../ds/primitives";
import { builderReducer, initialState, toTemplateInput, type BuilderDoc } from "./builder-state";
import { CanvasPanel } from "./canvas-panel";
import { CatalogPanel } from "./catalog-panel";
import { InspectorPanel } from "./inspector-panel";

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
  const [state, dispatch] = useReducer(builderReducer, initialDoc, (doc) => initialState(doc));
  const [pane, setPane] = useState<Pane>("canvas");
  const searchRef = useRef<HTMLInputElement>(null);
  const save = useSaveTemplate();
  const { present: doc } = state;

  // A new template restores its unsaved draft; an existing one always starts from the server copy.
  useEffect(() => {
    if (templateId) return;
    const draft = readDraft();
    if (draft?.items.length || draft?.name) dispatch({ type: "load", doc: draft });
  }, [templateId]);

  useEffect(() => {
    if (templateId || !state.dirty) return;
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(doc)); } catch { /* storage may be unavailable */ }
  }, [doc, state.dirty, templateId]);

  const add = useCallback((exercise: ExerciseSummary) => {
    dispatch({ type: "add", exercise, key: crypto.randomUUID() });
    setPane("canvas");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") { event.preventDefault(); setPane("catalog"); setTimeout(() => searchRef.current?.focus(), 0); }
      else if (meta && event.key.toLowerCase() === "z" && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); dispatch({ type: event.shiftKey ? "redo" : "undo" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);

  async function onSave() {
    if (!doc.name.trim()) return void toast.error(copy.builder.nameRequired);
    if (!doc.items.length) return void toast.error(copy.builder.exercisesRequired);
    try {
      const saved = await save.mutateAsync({ id: templateId, input: toTemplateInput(doc, templateId) });
      dispatch({ type: "saved" });
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success(copy.common.saved);
      if (!templateId) router.replace(`/${locale}/studio/templates/${saved.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError && error.code === "unknown_exercise" ? copy.builder.unknownExercise : copy.builder.saveFailed);
    }
  }

  const panes: Array<[Pane, string]> = [["catalog", copy.builder.catalog], ["canvas", doc.name || copy.templates.title], ["summary", copy.builder.summary]];

  return (
    <div className="mx-auto flex h-[calc(100dvh-2rem)] max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
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

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        <section aria-label={copy.builder.catalog} className={cn("min-h-0 flex-col", pane === "catalog" ? "flex" : "hidden lg:flex")}>
          <CatalogPanel copy={copy} onAdd={add} searchRef={searchRef} />
        </section>
        <section aria-label={doc.name || copy.templates.title} className={cn("min-h-0 overflow-y-auto pb-24 pr-1", pane === "canvas" ? "block" : "hidden lg:block")}>
          <CanvasPanel items={doc.items} copy={copy} dispatch={dispatch} />
        </section>
        <section aria-label={copy.builder.summary} className={cn("min-h-0 overflow-y-auto pb-6", pane === "summary" ? "block" : "hidden lg:block")}>
          <InspectorPanel items={doc.items} copy={copy} />
        </section>
      </div>
    </div>
  );
}
