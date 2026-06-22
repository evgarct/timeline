"use client";

import { detectMediaType, isHeicLike, MAX_UPLOAD_BYTES } from "@/domain/media";

const FULL_MAX_DIMENSION = 3000;
const THUMBNAIL_MAX_DIMENSION = 720;
const JPEG_QUALITY = 0.9;

export type PreparedProgressPhoto = {
  full: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
};

async function loadBitmap(file: File) {
  if (isHeicLike(file)) {
    const { heicTo } = await import("heic-to/next");
    return heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function scaledDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function renderJpeg(bitmap: ImageBitmap, maxDimension: number) {
  const dimensions = scaledDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("image_processing_failed");
  context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("image_processing_failed")), "image/jpeg", JPEG_QUALITY);
  });
  return { blob, ...dimensions };
}

export async function inspectFileType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return detectMediaType(bytes);
}

export async function prepareProgressPhoto(file: File): Promise<PreparedProgressPhoto> {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new Error("file_too_large");
  const detectedType = await inspectFileType(file);
  if (!detectedType || !["image/heic", "image/heif", "image/jpeg", "image/png"].includes(detectedType)) {
    throw new Error("unsupported_format");
  }
  const bitmap = await loadBitmap(file);
  try {
    const [full, thumbnail] = await Promise.all([
      renderJpeg(bitmap, FULL_MAX_DIMENSION),
      renderJpeg(bitmap, THUMBNAIL_MAX_DIMENSION)
    ]);
    return {
      full: full.blob,
      thumbnail: thumbnail.blob,
      width: full.width,
      height: full.height
    };
  } finally {
    bitmap.close();
  }
}

export async function prepareOcrImage(file: File) {
  if (!isHeicLike(file)) return file;
  const { heicTo } = await import("heic-to/next");
  return heicTo({ blob: file, type: "image/jpeg", quality: JPEG_QUALITY });
}
