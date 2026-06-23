import { randomUUID } from "node:crypto";
import { createPendingMediaAsset } from "@/data/media-repository";
import { getStorageQuota } from "@/data/storage-repository";
import { inBodyObjectKey, progressObjectKeys, uploadRequestSchema } from "@/domain/media";
import { canReserveStorage } from "@/domain/storage";
import { getCurrentUserId } from "@/lib/current-user";
import { createUploadUrl, isR2Configured } from "@/lib/r2";

const extensionByType = {
  "application/pdf": "pdf",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png"
} as const;

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isR2Configured) return Response.json({ error: "storage_not_configured" }, { status: 503 });

  const parsed = uploadRequestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_upload", details: parsed.error.flatten() }, { status: 400 });

  const id = randomUUID();
  const input = parsed.data;
  const proposedBytes = input.kind === "progress_photo"
    ? input.full.size + input.thumbnail.size
    : input.size;
  if (!canReserveStorage(await getStorageQuota(userId), proposedBytes)) {
    return Response.json({ error: "storage_quota_exceeded" }, { status: 413 });
  }

  if (input.kind === "progress_photo") {
    const { objectKey, thumbnailObjectKey } = progressObjectKeys(userId, id);
    await createPendingMediaAsset({
      id,
      userId,
      kind: input.kind,
      objectKey,
      thumbnailObjectKey,
      mimeType: "image/jpeg",
      originalFileName: input.fileName,
      width: input.full.width,
      height: input.full.height,
      sizeBytes: input.full.size,
      thumbnailSizeBytes: input.thumbnail.size
    });
    return Response.json({
      assetId: id,
      uploads: [
        { role: "full", url: await createUploadUrl(objectKey, "image/jpeg"), contentType: "image/jpeg" },
        { role: "thumbnail", url: await createUploadUrl(thumbnailObjectKey, "image/jpeg"), contentType: "image/jpeg" }
      ]
    }, { status: 201 });
  }

  const extension = extensionByType[input.mimeType];
  const objectKey = inBodyObjectKey(userId, id, extension);
  await createPendingMediaAsset({
    id,
    userId,
    kind: input.kind,
    objectKey,
    mimeType: input.mimeType,
    originalFileName: input.fileName,
    sizeBytes: input.size
  });
  return Response.json({
    assetId: id,
    uploads: [
      { role: "original", url: await createUploadUrl(objectKey, input.mimeType), contentType: input.mimeType }
    ]
  }, { status: 201 });
}
