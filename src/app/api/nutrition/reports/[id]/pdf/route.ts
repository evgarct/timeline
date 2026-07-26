import { getNutritionReport } from "@/data/nutrition-report-repository";
import { getObject } from "@/lib/r2";

// Real visitors reach this route directly via a middleware redirect from /r/[id] (see
// src/middleware.ts), so an expired/missing report needs to read as a page a person can land on, not a
// bare JSON error — mirrors the "Отчёт больше недоступен" copy the /r/[id] page shows a bot for the
// same case.
function reportUnavailableResponse() {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Отчёт недоступен</title></head><body style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;text-align:center;background:#f2ede4;color:#151109;font-family:system-ui, sans-serif;margin:0"><h1 style="font-size:1.5rem;font-weight:500">Отчёт больше недоступен</h1><p style="opacity:0.6">Ссылки на отчёты о питании действуют 10 дней.</p></body></html>`;
  return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const report = await getNutritionReport((await params).id);
  if (!report || report.expiresAt <= new Date()) {
    return reportUnavailableResponse();
  }
  try {
    const object = await getObject(report.pdfObjectKey);
    const headers = new Headers({
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="nutrition-report-${report.reportDate}.pdf"`,
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=86400"
    });
    if (object.ContentLength) headers.set("content-length", String(object.ContentLength));
    return new Response(object.Body!.transformToWebStream(), { headers });
  } catch {
    return reportUnavailableResponse();
  }
}
