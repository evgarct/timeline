import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getNutritionReport } from "@/data/nutrition-report-repository";
import { siteOrigin } from "@/lib/site-url";

// Link-preview crawlers (Telegram, WhatsApp, iMessage, etc.) must see the OG-tagged HTML below to
// build a rich preview — a real redirect would send them straight to the PDF with no card at all.
// Real visitors get sent straight to the PDF via `redirect()`; this list only needs to catch the
// crawlers that actually fetch link previews, not every bot on the internet.
const PREVIEW_BOT_USER_AGENT_PATTERN =
  /bot|facebookexternalhit|telegrambot|whatsapp|slackbot|discordbot|twitterbot|linkedinbot|skypeuripreview|vkshare|redditbot|pinterest|embedly|quora link preview|outbrain|w3c_validator|iframely/i;

function formattedDate(reportDate: string) {
  const date = new Date(`${reportDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return reportDate;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const report = await getNutritionReport(id);
  if (!report || report.expiresAt <= new Date()) {
    return { title: "Отчёт недоступен" };
  }
  const title = `Отчёт о питании за ${formattedDate(report.reportDate)}`;
  const description = "Дневная сводка питания и активности.";
  const imageUrl = `${siteOrigin()}/api/nutrition/reports/${id}/og-image`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] }
  };
}

export default async function NutritionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getNutritionReport(id);
  const expired = !report || report.expiresAt <= new Date();

  if (!expired) {
    const userAgent = (await headers()).get("user-agent") ?? "";
    if (!PREVIEW_BOT_USER_AGENT_PATTERN.test(userAgent)) {
      redirect(`/api/nutrition/reports/${id}/pdf`);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        background: "#f2ede4",
        color: "#151109",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      {expired ? (
        <>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500 }}>Отчёт больше недоступен</h1>
          <p style={{ opacity: 0.6 }}>Ссылки на отчёты о питании действуют 10 дней.</p>
        </>
      ) : (
        // Only link-preview crawlers reach this branch (real visitors were already redirected above) —
        // this is the page they fetch to build the OG card, so it just needs to carry the OG tags.
        <h1 style={{ fontSize: "1.5rem", fontWeight: 500 }}>
          Отчёт о питании за {formattedDate(report.reportDate)}
        </h1>
      )}
    </main>
  );
}
