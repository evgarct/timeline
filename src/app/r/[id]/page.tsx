import type { Metadata } from "next";
import { getNutritionReport } from "@/data/nutrition-report-repository";
import { siteOrigin } from "@/lib/site-url";

// The bot-vs-real-visitor redirect lives in src/middleware.ts, not here: `redirect()` called from this
// async Server Component (which also has an async generateMetadata) does not reliably produce an HTTP
// redirect in production — verified against the deployed app, a real browser UA still got a 200 HTML
// page instead of a 307. Middleware runs before any rendering and doesn't have that race, so only
// link-preview crawlers (which middleware lets through) ever reach this component.

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
        // Only link-preview crawlers reach this component at all (see the module comment above) — this
        // is the page they fetch to build the OG card, so it just needs to carry the OG tags.
        <h1 style={{ fontSize: "1.5rem", fontWeight: 500 }}>
          Отчёт о питании за {formattedDate(report.reportDate)}
        </h1>
      )}
    </main>
  );
}
