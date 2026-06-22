import { z } from "zod";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_PROGRESS_PHOTOS = 12;

export const storedMediaTypeSchema = z.enum([
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png"
]);

export type StoredMediaType = z.infer<typeof storedMediaTypeSchema>;

export const progressUploadRequestSchema = z.object({
  kind: z.literal("progress_photo"),
  fileName: z.string().min(1).max(255),
  sourceSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  sourceMimeType: z.string().max(100),
  full: z.object({
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    width: z.number().int().positive().max(12_000),
    height: z.number().int().positive().max(12_000)
  }),
  thumbnail: z.object({
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES)
  })
});

export const inBodyUploadRequestSchema = z.object({
  kind: z.literal("inbody"),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  mimeType: storedMediaTypeSchema
});

export const uploadRequestSchema = z.discriminatedUnion("kind", [
  progressUploadRequestSchema,
  inBodyUploadRequestSchema
]);

export function detectMediaType(bytes: Uint8Array): StoredMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp") {
    const brand = new TextDecoder().decode(bytes.slice(8, 12)).toLowerCase();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

export function isHeicLike(file: Pick<File, "name" | "type">) {
  return ["image/heic", "image/heif"].includes(file.type.toLowerCase())
    || /\.(heic|heif)$/i.test(file.name);
}

export function safeFileName(fileName: string) {
  return fileName.replace(/[\r\n"]/g, "_").slice(0, 255);
}

function userNamespace(userId: string) {
  return encodeURIComponent(userId);
}

export function progressObjectKeys(userId: string, assetId: string) {
  const base = `users/${userNamespace(userId)}/progress/${assetId}`;
  return { objectKey: `${base}/full.jpg`, thumbnailObjectKey: `${base}/thumbnail.jpg` };
}

export function inBodyObjectKey(userId: string, assetId: string, extension: string) {
  return `users/${userNamespace(userId)}/inbody/${assetId}/original.${extension}`;
}
