import { getMediaAsset, markMediaAssetReady } from "@/data/media-repository";
import { detectMediaType, MAX_UPLOAD_BYTES } from "@/domain/media";
import { getCurrentUserId } from "@/lib/current-user";
import { headObject, readObjectPrefix } from "@/lib/r2";
import { z } from "zod";

const requestSchema = z.object({ assetId: z.string().uuid() });

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_asset" }, { status: 400 });

  const asset = await getMediaAsset(userId, parsed.data.assetId);
  if (!asset) return Response.json({ error: "not_found" }, { status: 404 });
  if (asset.status === "ready") return Response.json({ assetId: asset.id, status: asset.status });
  if (asset.status !== "pending") return Response.json({ error: "asset_unavailable" }, { status: 409 });

  try {
    const object = await headObject(asset.objectKey);
    const size = object.ContentLength ?? 0;
    if (size <= 0 || size > MAX_UPLOAD_BYTES || size !== asset.sizeBytes) {
      return Response.json({ error: "invalid_size" }, { status: 422 });
    }
    const detectedType = detectMediaType(await readObjectPrefix(asset.objectKey));
    if (asset.kind === "progress_photo") {
      if (detectedType !== "image/jpeg" || object.ContentType !== "image/jpeg" || !asset.thumbnailObjectKey) {
        return Response.json({ error: "invalid_format" }, { status: 422 });
      }
      const thumbnail = await headObject(asset.thumbnailObjectKey);
      const thumbnailSize = thumbnail.ContentLength ?? 0;
      if (
        thumbnailSize <= 0
        || thumbnailSize !== asset.thumbnailSizeBytes
        || thumbnail.ContentType !== "image/jpeg"
        || detectMediaType(await readObjectPrefix(asset.thumbnailObjectKey)) !== "image/jpeg"
      ) {
        return Response.json({ error: "invalid_thumbnail" }, { status: 422 });
      }
    } else {
      const declared = asset.mimeType;
      const isHeifFamily = ["image/heic", "image/heif"].includes(declared)
        && ["image/heic", "image/heif"].includes(detectedType ?? "");
      if ((!isHeifFamily && detectedType !== declared) || object.ContentType !== declared) {
        return Response.json({ error: "invalid_format" }, { status: 422 });
      }
    }
    const ready = await markMediaAssetReady(userId, asset.id);
    return Response.json({ assetId: ready?.id ?? asset.id, status: ready?.status ?? "ready" });
  } catch {
    return Response.json({ error: "upload_incomplete" }, { status: 422 });
  }
}
