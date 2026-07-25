import { deleteMediaAssetRows, listCleanupMedia } from "@/data/media-repository";
import { deleteNutritionReportRows, listExpiredNutritionReports } from "@/data/nutrition-report-repository";
import { deleteObjects, isR2Configured } from "@/lib/r2";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured) return Response.json({ error: "storage_not_configured" }, { status: 503 });

  const assets = await listCleanupMedia(new Date(Date.now() - 24 * 60 * 60 * 1000));
  let deleted = 0;
  for (const asset of assets) {
    try {
      await deleteObjects([
        asset.objectKey,
        ...(asset.thumbnailObjectKey ? [asset.thumbnailObjectKey] : [])
      ]);
      await deleteMediaAssetRows([asset.id]);
      deleted += 1;
    } catch {
      // Retry on the next cleanup run.
    }
  }

  // Nutrition reports use an absolute 10-day expiry rather than the 24h orphan-sweep cutoff above,
  // so they're queried separately even though both run off this same daily cron.
  const expiredReports = await listExpiredNutritionReports(new Date());
  let deletedReports = 0;
  for (const report of expiredReports) {
    try {
      await deleteObjects([report.pdfObjectKey, report.ogImageObjectKey]);
      await deleteNutritionReportRows([report.id]);
      deletedReports += 1;
    } catch {
      // Retry on the next cleanup run.
    }
  }

  return Response.json({ scanned: assets.length, deleted, reportsScanned: expiredReports.length, reportsDeleted: deletedReports });
}

export const GET = POST;
