import { notFound } from "next/navigation";
import { Dashboard } from "@/components/studio/dashboard/dashboard";
import { isLocale } from "@/i18n/config";

export default async function StudioHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Dashboard locale={locale} />;
}
