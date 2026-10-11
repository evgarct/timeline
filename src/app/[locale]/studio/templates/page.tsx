import { notFound } from "next/navigation";
import { TemplateList } from "@/components/studio/template-list";
import { isLocale } from "@/i18n/config";

export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TemplateList locale={locale} />;
}
