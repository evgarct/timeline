import { getNutritionReport } from "@/data/nutrition-report-repository";
import { getObject } from "@/lib/r2";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const report = await getNutritionReport((await params).id);
  if (!report || report.expiresAt <= new Date()) {
    return Response.json({ error: "not_found" }, { status: 404 });
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
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
