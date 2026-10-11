import { notFound } from "next/navigation";
import { TemplateBuilder } from "@/components/studio/builder/template-builder";
import { isLocale } from "@/i18n/config";

export default async function NewTemplatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TemplateBuilder locale={locale} />;
}
