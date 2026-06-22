import { getMediaAsset } from "@/data/media-repository";
import { safeFileName } from "@/domain/media";
import { getCurrentUserId } from "@/lib/current-user";
import { getObject } from "@/lib/r2";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const asset = await getMediaAsset(userId, (await params).id);
  if (!asset || asset.status !== "ready" || asset.kind !== "inbody") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const object = await getObject(asset.objectKey);
    const headers = new Headers({
      "content-type": asset.mimeType,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName(asset.originalFileName))}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store"
    });
    if (object.ContentLength) headers.set("content-length", String(object.ContentLength));
    return new Response(object.Body!.transformToWebStream(), { headers });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
