import { notFound, redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/studio-shell";
import { isLocale } from "@/i18n/config";
import { getCurrentUserId } from "@/lib/current-user";

export default async function StudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await getCurrentUserId())) redirect(`/${locale}`);
  return <StudioShell locale={locale}>{children}</StudioShell>;
}
