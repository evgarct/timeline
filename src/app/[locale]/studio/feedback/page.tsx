import { notFound } from "next/navigation";
import { FeedbackInbox } from "@/components/studio/feedback-inbox";
import { isLocale } from "@/i18n/config";

export default async function FeedbackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <FeedbackInbox locale={locale} />;
}
