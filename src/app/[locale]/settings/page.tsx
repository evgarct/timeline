import { notFound } from "next/navigation";
import { SettingsScreen } from "@/components/fitness/settings-screen";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SettingsScreen locale={locale} copy={getMessages(locale)} />;
}

