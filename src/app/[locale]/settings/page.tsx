import { notFound, redirect } from "next/navigation";
import { SettingsScreen } from "@/components/fitness/settings-screen";
import { getStorageQuota } from "@/data/storage-repository";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getCurrentUserId } from "@/lib/current-user";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/${locale}`);
  return <SettingsScreen locale={locale} copy={getMessages(locale)} storageQuota={await getStorageQuota(userId)} />;
}

