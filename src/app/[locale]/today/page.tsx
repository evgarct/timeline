import { notFound } from "next/navigation";
import { TodayScreen } from "@/components/fitness/today-screen";
import { listEvents } from "@/data/repository";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getCurrentUserId } from "@/lib/current-user";

export default async function TodayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const userId = await getCurrentUserId();
  const events = userId ? await listEvents(userId) : [];
  return <TodayScreen locale={locale} copy={getMessages(locale)} initialEvents={events} userId={userId ?? ""} />;
}
