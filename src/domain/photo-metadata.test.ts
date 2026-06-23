import { describe, expect, it } from "vitest";
import { dateInputValue, localNoonFromDateInput, readPhotoTakenAt } from "./photo-metadata";

describe("photo metadata", () => {
  it("reads the original date from JPEG EXIF metadata", async () => {
    const result = await readPhotoTakenAt(fileLike(jpegWithExifDate("2026:06:20 08:12:33"), 0));
    expect(result?.source).toBe("exif");
    expect(dateInputValue(result!.date)).toBe("2026-06-20");
  });

  it("falls back to the file timestamp when EXIF is absent", async () => {
    const result = await readPhotoTakenAt(fileLike(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), new Date(2026, 5, 21).getTime()));
    expect(result?.source).toBe("file");
    expect(dateInputValue(result!.date)).toBe("2026-06-21");
  });

  it("creates local noon dates from date input values", () => {
    const value = localNoonFromDateInput("2026-06-22");
    expect(value.getFullYear()).toBe(2026);
    expect(value.getMonth()).toBe(5);
    expect(value.getDate()).toBe(22);
    expect(value.getHours()).toBe(12);
  });
});

function fileLike(bytes: Uint8Array, lastModified: number) {
  return {
    lastModified,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  } as Pick<File, "arrayBuffer" | "lastModified">;
}

function jpegWithExifDate(value: string) {
  const encoded = new TextEncoder().encode(`${value}\0`);
  const tiff = new Uint8Array(8 + 2 + 12 + 4 + encoded.length);
  tiff.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00], 0);
  tiff.set([0x01, 0x00], 8);
  tiff.set([0x32, 0x01, 0x02, 0x00], 10);
  writeUint32(tiff, 14, encoded.length);
  writeUint32(tiff, 18, 26);
  tiff.set([0x00, 0x00, 0x00, 0x00], 22);
  tiff.set(encoded, 26);
  const exif = new Uint8Array(6 + tiff.length);
  exif.set(new TextEncoder().encode("Exif\0\0"), 0);
  exif.set(tiff, 6);
  const length = exif.length + 2;
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    (length >> 8) & 255,
    length & 255,
    ...exif,
    0xff,
    0xd9
  ]);
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 255;
  bytes[offset + 1] = (value >> 8) & 255;
  bytes[offset + 2] = (value >> 16) & 255;
  bytes[offset + 3] = (value >> 24) & 255;
}
