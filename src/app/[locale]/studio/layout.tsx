import { notFound, redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/studio-shell";
import { isLocale } from "@/i18n/config";
import { getCurrentUserId } from "@/lib/current-user";

export default async function StudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await getCurrentUserId())) redirect(`/${locale}`);
  // Chrome's WebMCP origin trial token (registered for this origin by the owner); without it the tools only work
  // with the local chrome://flags/#enable-webmcp-testing flag. React hoists the tag into <head>.
  const webMcpToken = process.env.NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN;
  return (
    <>
      {webMcpToken ? <meta httpEquiv="origin-trial" content={webMcpToken} /> : null}
      <StudioShell locale={locale}>{children}</StudioShell>
    </>
  );
}
