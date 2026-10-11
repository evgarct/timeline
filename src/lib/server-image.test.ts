import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeProgressPhoto } from "./server-image";

// Small generated pictures only: no real photos in tests.
async function sample(width: number, height: number, options: { orientation?: number; format?: "jpeg" | "png" | "webp" } = {}) {
  let image = sharp({ create: { width, height, channels: 3, background: { r: 40, g: 120, b: 200 } } });
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  const format = options.format ?? "jpeg";
  return image[format]().toBuffer();
}

describe("normalizeProgressPhoto", () => {
  it("produces an upright metadata-free JPEG and a 720 px thumbnail", async () => {
    // 400x200 stored sideways (EXIF orientation 6 = rotate 90 degrees): upright it is 200x400
    const result = await normalizeProgressPhoto(await sample(400, 200, { orientation: 6 }));
    expect([result.width, result.height]).toEqual([200, 400]);
    const full = await sharp(result.full).metadata();
    expect(full.format).toBe("jpeg");
    expect(full.exif).toBeUndefined();
    expect(full.orientation).toBeUndefined();
    const thumb = await sharp(result.thumbnail).metadata();
    expect(thumb.format).toBe("jpeg");
    expect(Math.max(thumb.width ?? 0, thumb.height ?? 0)).toBeLessThanOrEqual(720);
  });

  it("scales a large picture down to 3000 px and a thumbnail to 720 px", async () => {
    const result = await normalizeProgressPhoto(await sample(4000, 2000));
    expect(result.width).toBe(3000);
    expect(result.height).toBe(1500);
    expect((await sharp(result.thumbnail).metadata()).width).toBe(720);
  });

  it("accepts PNG and WebP and returns a readable palette", async () => {
    for (const format of ["png", "webp"] as const) {
      const result = await normalizeProgressPhoto(await sample(120, 90, { format }));
      expect(result.palette.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(result.palette.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(["#211d19", "#f8f4ee"]).toContain(result.palette.foreground);
    }
  });

  it("rejects bytes that are not a picture", async () => {
    await expect(normalizeProgressPhoto(new TextEncoder().encode("not an image"))).rejects.toThrow("invalid_image");
  });
});
