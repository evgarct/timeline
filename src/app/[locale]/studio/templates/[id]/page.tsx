import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/studio/builder/template-editor";
import { isLocale } from "@/i18n/config";

export default async function EditTemplatePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <TemplateEditor locale={locale} templateId={id} />;
}
