import { notFound } from "next/navigation";
import { BodyPage } from "@/components/studio/body/body-page";
import { isLocale } from "@/i18n/config";

export default async function StudioBodyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BodyPage locale={locale} />;
}
