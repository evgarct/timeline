"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Locale } from "@/i18n/config";
import { getStudioCopy } from "@/i18n/studio-messages";
import { useDeleteTemplate, useTemplates } from "@/lib/studio/api";
import { spatial } from "@/lib/motion/tokens";
import { Eyebrow, StudioButton, Surface } from "./ds/primitives";

export function TemplateList({ locale }: { locale: Locale }) {
  const copy = getStudioCopy(locale);
  const templates = useTemplates();
  const remove = useDeleteTemplate();
  const base = `/${locale}/studio/templates`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>{copy.templates.eyebrow}</Eyebrow>
          <h1 className="s-serif mt-1 text-4xl tracking-tight md:text-5xl">{copy.templates.title}</h1>
        </div>
        <Link href={`${base}/new`}>
          <StudioButton size="lg"><Plus className="size-5" />{copy.templates.new}</StudioButton>
        </Link>
      </header>

      <div className="mt-8">
        {templates.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy>{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-[var(--s-radius-xl)] bg-[var(--s-surface-container)]" />)}</div>
        ) : templates.isError ? (
          <div className="space-y-4 py-16 text-center">
            <p className="s-serif text-2xl">{copy.templates.loadError}</p>
            <StudioButton onClick={() => void templates.refetch()}>{copy.common.retry}</StudioButton>
          </div>
        ) : !templates.data.length ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spatial.default} className="grid place-items-center rounded-[var(--s-radius-xl)] border border-dashed border-[var(--s-outline-variant)] px-6 py-20 text-center">
            <div className="s-serif text-3xl">{copy.templates.empty}</div>
            <p className="mt-2 max-w-sm text-[var(--s-on-surface-variant)]">{copy.templates.emptyHint}</p>
            <Link href={`${base}/new`} className="mt-6"><StudioButton>{copy.templates.open}</StudioButton></Link>
          </motion.div>
        ) : (
          <motion.ul layout className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {templates.data.map((template, index) => (
                <motion.li key={template.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ ...spatial.default, delay: index * 0.04 }}>
                  <Surface tone="primary" interactive className="relative h-full overflow-hidden p-5">
                    <Link href={`${base}/${template.id}`} className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]" aria-label={template.name} />
                    <div className="s-serif text-2xl leading-tight">{template.name}</div>
                    <div className="mt-1 text-[13px] text-[var(--s-on-surface-variant)]">
                      <span className="s-num">{template.exercises.length}</span> {copy.common.exercises} · <span className="s-num">{template.exercises.reduce((sum, entry) => sum + entry.sets, 0)}</span> {copy.common.sets}
                    </div>
                    <button
                      type="button"
                      aria-label={`${copy.common.delete}: ${template.name}`}
                      onClick={() => { if (window.confirm(copy.templates.deleteConfirm)) remove.mutate(template.id, { onError: () => toast.error(copy.builder.saveFailed) }); }}
                      className="relative z-10 mt-6 grid size-9 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--s-error)_14%,transparent)] hover:text-[var(--s-error)] focus-visible:ring-2 focus-visible:ring-[var(--s-error)]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </Surface>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}
