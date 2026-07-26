import { randomUUID } from "node:crypto";
import { createNutritionReport } from "@/data/nutrition-report-repository";
import { MAX_NUTRITION_REPORT_BYTES, nutritionReportObjectKeys } from "@/domain/media";
import { getCurrentUserId } from "@/lib/current-user";
import { isR2Configured, putObject } from "@/lib/r2";
import { siteOrigin } from "@/lib/site-url";

const REPORT_LIFETIME_MS = 10 * 24 * 60 * 60 * 1000;
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Duck-typed rather than `instanceof Blob`: the test environment's FormData/Blob globals don't share
// a prototype chain with the runtime's, and the shape check is what actually matters here.
function isBlobLike(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null
    && "size" in value && "arrayBuffer" in value && typeof (value as File).arrayBuffer === "function";
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isR2Configured) return Response.json({ error: "storage_not_configured" }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const pdf = form.get("pdf");
  const ogImage = form.get("ogImage");
  const reportDate = form.get("reportDate");
  const timezone = form.get("timezone");

  if (
    !isBlobLike(pdf) || !isBlobLike(ogImage)
    || typeof reportDate !== "string" || !REPORT_DATE_PATTERN.test(reportDate)
    || typeof timezone !== "string" || timezone.length < 1 || timezone.length > 100
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (pdf.size <= 0 || pdf.size > MAX_NUTRITION_REPORT_BYTES || ogImage.size <= 0 || ogImage.size > MAX_NUTRITION_REPORT_BYTES) {
    return Response.json({ error: "invalid_size" }, { status: 413 });
  }

  const id = randomUUID();
  const { pdfObjectKey, ogImageObjectKey } = nutritionReportObjectKeys(userId, id);
  const [pdfBytes, ogImageBytes] = await Promise.all([
    pdf.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
    ogImage.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  ]);

  await Promise.all([
    putObject(pdfObjectKey, pdfBytes, "application/pdf"),
    putObject(ogImageObjectKey, ogImageBytes, "image/jpeg")
  ]);

  await createNutritionReport({
    id,
    userId,
    reportDate,
    timezone,
    pdfObjectKey,
    ogImageObjectKey,
    pdfSizeBytes: pdf.size,
    ogImageSizeBytes: ogImage.size,
    expiresAt: new Date(Date.now() + REPORT_LIFETIME_MS)
  });

  return Response.json({ reportId: id, shareUrl: `${siteOrigin()}/r/${id}` }, { status: 201 });
}
