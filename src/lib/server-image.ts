import sharp from "sharp";

const FULL_MAX_DIMENSION = 3000;
const THUMBNAIL_MAX_DIMENSION = 720;
const JPEG_QUALITY = 90;

export interface NormalizedProgressPhoto {
  full: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  palette: { background: string; accent: string; foreground: string };
}

type Rgb = { red: number; green: number; blue: number };

const mix = (color: Rgb, target: Rgb, amount: number): Rgb => ({
  red: Math.round(color.red * (1 - amount) + target.red * amount),
  green: Math.round(color.green * (1 - amount) + target.green * amount),
  blue: Math.round(color.blue * (1 - amount) + target.blue * amount)
});
const hex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
const toHex = (color: Rgb) => `#${hex(color.red)}${hex(color.green)}${hex(color.blue)}`;
const luminance = (color: Rgb) => (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255;

/** Same palette rule as the browser upload (`extractPalette` in image-processing.ts): the average colour softened toward paper. */
function paletteOf(average: Rgb) {
  return {
    background: toHex(mix(average, { red: 246, green: 242, blue: 236 }, 0.72)),
    accent: toHex(mix(average, { red: 255, green: 255, blue: 255 }, 0.52)),
    foreground: luminance(average) > 0.54 ? "#211d19" : "#f8f4ee"
  };
}

/**
 * Turns an uploaded picture (JPEG, PNG or WebP) into what the app stores for progress photos: a metadata-free JPEG at
 * most 3000 px on its long side plus a 720 px thumbnail, rotated upright from its EXIF orientation. Throws
 * `invalid_image` for anything sharp cannot decode.
 */
export async function normalizeProgressPhoto(input: Uint8Array): Promise<NormalizedProgressPhoto> {
  try {
    // rotate() applies the EXIF orientation; sharp drops all metadata (EXIF, GPS, ICC) on output unless asked to keep it.
    const upright = sharp(input, { failOn: "error" }).rotate().flatten({ background: "#ffffff" });
    const full = await upright.clone()
      .resize({ width: FULL_MAX_DIMENSION, height: FULL_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const thumbnail = await upright.clone()
      .resize({ width: THUMBNAIL_MAX_DIMENSION, height: THUMBNAIL_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    const stats = await sharp(full.data).resize(24, 24, { fit: "inside" }).stats();
    const [red, green, blue] = stats.channels;
    return {
      full: full.data,
      thumbnail,
      width: full.info.width,
      height: full.info.height,
      palette: paletteOf({ red: Math.round(red?.mean ?? 0), green: Math.round(green?.mean ?? 0), blue: Math.round(blue?.mean ?? 0) })
    };
  } catch {
    throw new Error("invalid_image");
  }
}
