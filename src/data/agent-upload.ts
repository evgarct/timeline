import "server-only";
import { randomUUID } from "node:crypto";
import { claimPendingMediaAsset, completeUploadedMediaAsset, createPendingMediaAsset, getMediaAsset, releaseMediaAssetClaim } from "@/data/media-repository";
import { getStorageQuota } from "@/data/storage-repository";
import { detectMediaType, inBodyObjectKey, MAX_AGENT_UPLOAD_BYTES, progressObjectKeys, safeFileName } from "@/domain/media";
import { canReserveStorage } from "@/domain/storage";
import { signUploadToken, UPLOAD_LINK_TTL_MS, verifyUploadToken } from "@/lib/agent-upload-token";
import { isR2Configured, putObject } from "@/lib/r2";
import { normalizeProgressPhoto } from "@/lib/server-image";
import { siteOrigin } from "@/lib/site-url";

/** Raised with a stable `code` that REST maps to a status and MCP shows as text. */
export class AgentUploadError extends Error {
  constructor(public code: "storage_not_configured" | "storage_quota_exceeded" | "invalid_token" | "asset_unavailable" | "payload_too_large" | "invalid_image" | "unsupported_heic" | "empty_body" | "unsupported_file") {
    super(code);
  }
}

const signingSecret = () => process.env.R2_SECRET_ACCESS_KEY ?? "";

/** The object key carries a cosmetic extension taken from the file name; the stored type is sniffed from the bytes. */
const extensionOf = (fileName: string) => {
  const match = /\.(pdf|jpe?g|png|heic|heif)$/i.exec(fileName);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "bin";
};

/**
 * Reserves a media asset and returns a one-time link the agent can POST raw bytes to: a progress photo (normalized to a
 * JPEG pair) or an InBody original (kept byte for byte). The link lives on this site (not on R2), so a page on another
 * origin, such as a web chat, can use it without cookies or R2 CORS.
 */
export async function createAgentUploadLink(userId: string, input: { fileName?: string; kind?: "progress_photo" | "inbody" }) {
  if (!isR2Configured) throw new AgentUploadError("storage_not_configured");
  const kind = input.kind ?? "progress_photo";
  // The reservation is the largest accepted upload (plus its thumbnail for a photo); the real sizes replace it on completion.
  const reserved = MAX_AGENT_UPLOAD_BYTES;
  if (!canReserveStorage(await getStorageQuota(userId), kind === "inbody" ? reserved : reserved * 2)) throw new AgentUploadError("storage_quota_exceeded");

  const assetId = randomUUID();
  if (kind === "inbody") {
    const fileName = safeFileName(input.fileName ?? "inbody-report");
    await createPendingMediaAsset({
      id: assetId,
      userId,
      kind,
      objectKey: inBodyObjectKey(userId, assetId, extensionOf(fileName)),
      // Replaced by the sniffed type when the bytes arrive.
      mimeType: "application/octet-stream",
      originalFileName: fileName,
      sizeBytes: reserved
    });
  } else {
    const { objectKey, thumbnailObjectKey } = progressObjectKeys(userId, assetId);
    await createPendingMediaAsset({
      id: assetId,
      userId,
      kind,
      objectKey,
      thumbnailObjectKey,
      mimeType: "image/jpeg",
      originalFileName: safeFileName(input.fileName ?? "agent-upload.jpg"),
      sizeBytes: reserved,
      thumbnailSizeBytes: reserved
    });
  }
  const expiresAt = Date.now() + UPLOAD_LINK_TTL_MS;
  const token = signUploadToken({ userId, assetId, expiresAt }, signingSecret());
  return {
    assetId,
    kind,
    uploadUrl: `${siteOrigin()}/api/uploads/agent/${token}`,
    expiresAt: new Date(expiresAt).toISOString(),
    maxBytes: MAX_AGENT_UPLOAD_BYTES
  };
}

/** Stores the uploaded bytes (normalized photo pair, or the untouched InBody original) and marks the asset ready (one use per link). */
export async function ingestAgentUpload(token: string, bytes: Uint8Array) {
  if (!isR2Configured) throw new AgentUploadError("storage_not_configured");
  const payload = verifyUploadToken(token, signingSecret());
  if (!payload) throw new AgentUploadError("invalid_token");
  if (!bytes.byteLength) throw new AgentUploadError("empty_body");
  if (bytes.byteLength > MAX_AGENT_UPLOAD_BYTES) throw new AgentUploadError("payload_too_large");

  const asset = await getMediaAsset(payload.userId, payload.assetId);
  if (!asset || asset.status !== "pending") throw new AgentUploadError("asset_unavailable");
  if (asset.kind === "inbody") return ingestInBodyOriginal(payload, asset, bytes);
  if (asset.kind !== "progress_photo") throw new AgentUploadError("asset_unavailable");

  // HEVC pictures (iPhone originals) cannot be decoded here; say so instead of a generic "invalid image".
  const detected = detectMediaType(bytes.subarray(0, 16));
  if (detected === "image/heic" || detected === "image/heif") throw new AgentUploadError("unsupported_heic");

  // Decoding has no side effects, so a bad picture leaves the link usable; only the writes are exclusive.
  let photo;
  try {
    photo = await normalizeProgressPhoto(bytes);
  } catch {
    throw new AgentUploadError("invalid_image");
  }
  // One request at a time writes the objects: a concurrent retry of the same link must not overwrite them.
  if (!(await claimPendingMediaAsset(payload.userId, payload.assetId))) throw new AgentUploadError("asset_unavailable");
  try {
    await putObject(asset.objectKey, photo.full, "image/jpeg");
    if (asset.thumbnailObjectKey) await putObject(asset.thumbnailObjectKey, photo.thumbnail, "image/jpeg");
    const ready = await completeUploadedMediaAsset(payload.userId, payload.assetId, {
      width: photo.width,
      height: photo.height,
      sizeBytes: photo.full.byteLength,
      thumbnailSizeBytes: photo.thumbnail.byteLength
    });
    if (!ready) throw new AgentUploadError("asset_unavailable");
    return { kind: "progress_photo" as const, assetId: ready.id, width: photo.width, height: photo.height, palette: photo.palette };
  } catch (error) {
    await releaseMediaAssetClaim(payload.userId, payload.assetId).catch(() => undefined);
    throw error;
  }
}

/** An InBody sheet is evidence for the coach, so it is stored exactly as sent; only its type is checked from the magic bytes. */
async function ingestInBodyOriginal(payload: { userId: string; assetId: string }, asset: { objectKey: string }, bytes: Uint8Array) {
  const mimeType = detectMediaType(bytes.subarray(0, 16));
  if (!mimeType) throw new AgentUploadError("unsupported_file");
  if (!(await claimPendingMediaAsset(payload.userId, payload.assetId))) throw new AgentUploadError("asset_unavailable");
  try {
    await putObject(asset.objectKey, bytes, mimeType);
    const ready = await completeUploadedMediaAsset(payload.userId, payload.assetId, { sizeBytes: bytes.byteLength, mimeType });
    if (!ready) throw new AgentUploadError("asset_unavailable");
    return { kind: "inbody" as const, assetId: ready.id, mimeType, sizeBytes: bytes.byteLength };
  } catch (error) {
    await releaseMediaAssetClaim(payload.userId, payload.assetId).catch(() => undefined);
    throw error;
  }
}
