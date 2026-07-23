import { notFound, redirect } from "next/navigation";
import { SettingsScreen } from "@/components/fitness/settings-screen";
import { headers } from "next/headers";
import { getStorageQuota } from "@/data/storage-repository";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getCurrentUserId } from "@/lib/current-user";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/${locale}`);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const mcpEndpoint = host ? `${protocol}://${host}/api/mcp` : "/api/mcp";
  return (
    <SettingsScreen
      locale={locale}
      copy={getMessages(locale)}
      storageQuota={await getStorageQuota(userId)}
      mcpEndpoint={mcpEndpoint}
    />
  );
}

