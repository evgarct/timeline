import type { Metadata } from "next";
import { headers } from "next/headers";
import { getNutritionReport } from "@/data/nutrition-report-repository";

async function originURL() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "";
  const protocol = list.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

function formattedDate(reportDate: string) {
  const date = new Date(`${reportDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return reportDate;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const report = await getNutritionReport(id);
  const origin = await originURL();
  if (!report || report.expiresAt <= new Date()) {
    return { title: "Отчёт недоступен" };
  }
  const title = `Отчёт о питании за ${formattedDate(report.reportDate)}`;
  const description = "Дневная сводка питания и активности.";
  const imageUrl = `${origin}/api/nutrition/reports/${id}/og-image`;
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
        <>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500 }}>
            Отчёт о питании за {formattedDate(report.reportDate)}
          </h1>
          <a
            href={`/api/nutrition/reports/${id}/pdf`}
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "999px",
              background: "#151109",
              color: "#f2ede4",
              textDecoration: "none",
              fontWeight: 500
            }}
          >
            Открыть PDF
          </a>
        </>
      )}
    </main>
  );
}
