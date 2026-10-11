"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { StudioCopy } from "@/i18n/studio-messages";
import { useTemplates } from "@/lib/studio/api";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { useUnsavedGuard } from "../unsaved-guard";

/**
 * Navigation inside the templates section: a breadcrumb back to the list and a switcher to jump to another template
 * or start a new one. Every link asks first while the editor has unsaved changes.
 */
export function TemplatesNav({ locale, copy, templateId }: { locale: Locale; copy: StudioCopy; templateId?: string }) {
  const guard = useUnsavedGuard();
  const templates = useTemplates();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const base = `/${locale}/studio/templates`;
  const confirm = (event: React.MouseEvent) => guard?.confirmLeave(event, copy.builder.leaveConfirm);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const others = (templates.data ?? []).filter((template) => template.id !== templateId && !template.isArchived);

  return (
    <nav aria-label={copy.templates.title} className="flex items-center gap-1 text-[13px] text-[var(--s-on-surface-variant)]">
      <Link href={base} onClick={confirm} className="rounded-full px-2 py-1 font-medium text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container)] hover:text-[var(--s-on-background)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
        {copy.templates.title}
      </Link>
      <ChevronRight className="size-3.5 opacity-60" aria-hidden />
      <div ref={root} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 rounded-full px-2 py-1 font-medium outline-none hover:bg-[var(--s-surface-container)] hover:text-[var(--s-on-background)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"
        >
          {copy.builder.switchTemplate}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence>
          {open ? (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spatial.fast}
              className="absolute left-0 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-[var(--s-radius-lg)] bg-[var(--s-surface-container-high)] p-1.5 text-[var(--s-on-background)] shadow-[0_20px_50px_-20px_var(--s-glow)]"
            >
              {others.map((template) => (
                <Link key={template.id} role="menuitem" href={`${base}/${template.id}`} onClick={(event) => { confirm(event); if (!event.defaultPrevented) setOpen(false); }} className="block truncate rounded-[var(--s-radius-sm)] px-3 py-2 text-sm outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                  {template.name}
                </Link>
              ))}
              {!others.length && !templates.isPending ? <div className="px-3 py-2 text-sm text-[var(--s-on-surface-variant)]">{copy.templates.empty}</div> : null}
              {/* On /new the link would target the current URL and keep the stored draft, so it is offered only from a saved template. */}
              {templateId ? <Link role="menuitem" href={`${base}/new`} onClick={(event) => { confirm(event); if (!event.defaultPrevented) setOpen(false); }} className="mt-1 flex items-center gap-2 rounded-[var(--s-radius-sm)] px-3 py-2 text-sm font-semibold text-[var(--s-primary)] outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                <Plus className="size-4" />{copy.builder.newTemplate}
              </Link> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </nav>
  );
}
