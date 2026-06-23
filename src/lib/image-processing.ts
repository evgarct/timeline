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
  palette: {
    background: string;
    accent: string;
    foreground: string;
  };
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
  const palette = extractPalette(context, dimensions.width, dimensions.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("image_processing_failed")), "image/jpeg", JPEG_QUALITY);
  });
  return { blob, palette, ...dimensions };
}

function extractPalette(context: CanvasRenderingContext2D, width: number, height: number) {
  const sampleWidth = Math.max(1, Math.min(24, width));
  const sampleHeight = Math.max(1, Math.min(24, height));
  const sample = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < sample.length; index += 4) {
    red += sample[index] ?? 0;
    green += sample[index + 1] ?? 0;
    blue += sample[index + 2] ?? 0;
    count += 1;
  }
  const average = {
    red: Math.round(red / count),
    green: Math.round(green / count),
    blue: Math.round(blue / count)
  };
  return {
    background: toHex(mix(average, { red: 246, green: 242, blue: 236 }, 0.72)),
    accent: toHex(mix(average, { red: 255, green: 255, blue: 255 }, 0.52)),
    foreground: luminance(average) > 0.54 ? "#211d19" : "#f8f4ee"
  };
}

function mix(color: { red: number; green: number; blue: number }, target: { red: number; green: number; blue: number }, amount: number) {
  return {
    red: Math.round(color.red * (1 - amount) + target.red * amount),
    green: Math.round(color.green * (1 - amount) + target.green * amount),
    blue: Math.round(color.blue * (1 - amount) + target.blue * amount)
  };
}

function luminance(color: { red: number; green: number; blue: number }) {
  return (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255;
}

function toHex(color: { red: number; green: number; blue: number }) {
  return `#${hex(color.red)}${hex(color.green)}${hex(color.blue)}`;
}

function hex(value: number) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
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
      height: full.height,
      palette: thumbnail.palette
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
