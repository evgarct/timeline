import { deleteMediaAssetRows, listCleanupMedia } from "@/data/media-repository";
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
  return Response.json({ scanned: assets.length, deleted });
}

export const GET = POST;
