"use client";

import { useMemo } from "react";
import type { Locale } from "@/i18n/config";
import { getStudioCopy } from "@/i18n/studio-messages";
import { useTemplateDoc } from "@/lib/studio/api";
import { StudioButton } from "../ds/primitives";
import { docFromTemplate } from "./builder-state";
import { TemplateBuilder } from "./template-builder";

/** Loads a stored template (and the exercises it references), then hands the doc to the builder. */
export function TemplateEditor({ locale, templateId }: { locale: Locale; templateId: string }) {
  const copy = getStudioCopy(locale);
  const query = useTemplateDoc(templateId);
  const doc = useMemo(() => (query.data ? docFromTemplate(query.data.template, query.data.catalog) : undefined), [query.data]);

  if (query.isError) {
    return (
      <div className="grid min-h-[60dvh] place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="s-serif text-2xl">{copy.templates.loadError}</p>
          <StudioButton onClick={() => void query.refetch()}>{copy.common.retry}</StudioButton>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="grid min-h-[60dvh] place-items-center text-[var(--s-on-surface-variant)]" aria-busy>{copy.common.loading}</div>;
  return <TemplateBuilder locale={locale} templateId={templateId} initialDoc={doc} />;
}
