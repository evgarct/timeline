import { getMediaAsset } from "@/data/media-repository";
import { listEvents } from "@/data/repository";
import { isInBodyEvent } from "@/domain/inbody";
import { getCurrentUserId } from "@/lib/current-user";
import { createDownloadUrl, isR2Configured } from "@/lib/r2";

// A short-lived download link for the original InBody sheet of one test (the link is not stored anywhere).
export async function GET(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { eventId } = await params;
  const event = (await listEvents(userId, { type: "inbody" }, { hydrate: false })).filter(isInBodyEvent).find((item) => item.id === eventId);
  if (!event) return Response.json({ error: "event_not_found" }, { status: 404 });
  if (!event.source.assetId) return Response.json({ error: "original_unavailable" }, { status: 404 });
  const asset = await getMediaAsset(userId, event.source.assetId);
  if (!asset || asset.status !== "ready" || !isR2Configured) return Response.json({ error: "original_unavailable" }, { status: 404 });
  return Response.json({
    eventId,
    assetId: asset.id,
    fileName: asset.originalFileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    url: await createDownloadUrl(asset.objectKey)
  });
}
