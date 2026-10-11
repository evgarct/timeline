import "server-only";
import { randomUUID } from "node:crypto";
import { completeUploadedMediaAsset, createPendingMediaAsset, getMediaAsset } from "@/data/media-repository";
import { getStorageQuota } from "@/data/storage-repository";
import { MAX_AGENT_UPLOAD_BYTES, progressObjectKeys, safeFileName } from "@/domain/media";
import { canReserveStorage } from "@/domain/storage";
import { signUploadToken, UPLOAD_LINK_TTL_MS, verifyUploadToken } from "@/lib/agent-upload-token";
import { isR2Configured, putObject } from "@/lib/r2";
import { normalizeProgressPhoto } from "@/lib/server-image";
import { siteOrigin } from "@/lib/site-url";

/** Raised with a stable `code` that REST maps to a status and MCP shows as text. */
export class AgentUploadError extends Error {
  constructor(public code: "storage_not_configured" | "storage_quota_exceeded" | "invalid_token" | "asset_unavailable" | "payload_too_large" | "invalid_image" | "empty_body") {
    super(code);
  }
}

const signingSecret = () => process.env.R2_SECRET_ACCESS_KEY ?? "";

/**
 * Reserves a progress-photo asset and returns a one-time link the agent can POST raw picture bytes to. The link lives on
 * this site (not on R2), so a page on another origin, such as a web chat, can use it without cookies or R2 CORS.
 */
export async function createAgentUploadLink(userId: string, input: { fileName?: string }) {
  if (!isR2Configured) throw new AgentUploadError("storage_not_configured");
  // The reservation is the largest accepted upload plus its thumbnail; the real sizes replace it on completion.
  const reserved = MAX_AGENT_UPLOAD_BYTES;
  if (!canReserveStorage(await getStorageQuota(userId), reserved * 2)) throw new AgentUploadError("storage_quota_exceeded");

  const assetId = randomUUID();
  const { objectKey, thumbnailObjectKey } = progressObjectKeys(userId, assetId);
  await createPendingMediaAsset({
    id: assetId,
    userId,
    kind: "progress_photo",
    objectKey,
    thumbnailObjectKey,
    mimeType: "image/jpeg",
    originalFileName: safeFileName(input.fileName ?? "agent-upload.jpg"),
    sizeBytes: reserved,
    thumbnailSizeBytes: reserved
  });
  const expiresAt = Date.now() + UPLOAD_LINK_TTL_MS;
  const token = signUploadToken({ userId, assetId, expiresAt }, signingSecret());
  return {
    assetId,
    uploadUrl: `${siteOrigin()}/api/uploads/agent/${token}`,
    expiresAt: new Date(expiresAt).toISOString(),
    maxBytes: MAX_AGENT_UPLOAD_BYTES
  };
}

/** Normalizes the uploaded picture, stores the full and thumbnail JPEGs and marks the asset ready (one use per link). */
export async function ingestAgentUpload(token: string, bytes: Uint8Array) {
  if (!isR2Configured) throw new AgentUploadError("storage_not_configured");
  const payload = verifyUploadToken(token, signingSecret());
  if (!payload) throw new AgentUploadError("invalid_token");
  if (!bytes.byteLength) throw new AgentUploadError("empty_body");
  if (bytes.byteLength > MAX_AGENT_UPLOAD_BYTES) throw new AgentUploadError("payload_too_large");

  const asset = await getMediaAsset(payload.userId, payload.assetId);
  if (!asset || asset.kind !== "progress_photo" || asset.status !== "pending") throw new AgentUploadError("asset_unavailable");

  let photo;
  try {
    photo = await normalizeProgressPhoto(bytes);
  } catch {
    throw new AgentUploadError("invalid_image");
  }
  await putObject(asset.objectKey, photo.full, "image/jpeg");
  if (asset.thumbnailObjectKey) await putObject(asset.thumbnailObjectKey, photo.thumbnail, "image/jpeg");
  const ready = await completeUploadedMediaAsset(payload.userId, payload.assetId, {
    width: photo.width,
    height: photo.height,
    sizeBytes: photo.full.byteLength,
    thumbnailSizeBytes: photo.thumbnail.byteLength
  });
  if (!ready) throw new AgentUploadError("asset_unavailable");
  return { assetId: ready.id, width: photo.width, height: photo.height, palette: photo.palette };
}
