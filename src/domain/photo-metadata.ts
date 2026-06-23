export type PhotoTakenAtSource = "exif" | "file";

export type PhotoTakenAt = {
  date: Date;
  source: PhotoTakenAtSource;
};

const EXIF_TAG_DATE_TIME_ORIGINAL = 0x9003;
const EXIF_TAG_DATE_TIME_DIGITIZED = 0x9004;
const TIFF_TAG_DATE_TIME = 0x0132;
const EXIF_POINTER_TAG = 0x8769;

export async function readPhotoTakenAt(file: Pick<File, "arrayBuffer" | "lastModified">): Promise<PhotoTakenAt | null> {
  const buffer = await file.arrayBuffer();
  const exifDate = readJpegExifDate(new DataView(buffer));
  if (exifDate) return { date: exifDate, source: "exif" };
  if (file.lastModified > 0) return { date: new Date(file.lastModified), source: "file" };
  return null;
}

export function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localNoonFromDateInput(value: string) {
  return new Date(`${value}T12:00:00`);
}

function readJpegExifDate(view: DataView) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && offset + 4 + length <= view.byteLength) {
      const date = readExifSegment(view, offset + 4, length - 2);
      if (date) return date;
    }
    offset += 2 + length;
  }
  return null;
}

function readExifSegment(view: DataView, offset: number, length: number) {
  if (length < 14 || ascii(view, offset, 6) !== "Exif\0\0") return null;
  const tiffOffset = offset + 6;
  const littleEndian = ascii(view, tiffOffset, 2) === "II";
  const firstIfdOffset = readUint32(view, tiffOffset + 4, littleEndian);
  return readIfdDate(view, tiffOffset, tiffOffset + firstIfdOffset, littleEndian);
}

function readIfdDate(view: DataView, tiffOffset: number, ifdOffset: number, littleEndian: boolean): Date | null {
  if (ifdOffset + 2 > view.byteLength) return null;
  const entries = readUint16(view, ifdOffset, littleEndian);
  let exifIfdOffset: number | null = null;
  for (let index = 0; index < entries; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) return null;
    const tag = readUint16(view, entryOffset, littleEndian);
    if ([EXIF_TAG_DATE_TIME_ORIGINAL, EXIF_TAG_DATE_TIME_DIGITIZED, TIFF_TAG_DATE_TIME].includes(tag)) {
      const value = readAsciiValue(view, tiffOffset, entryOffset, littleEndian);
      const date = parseExifDate(value);
      if (date) return date;
    }
    if (tag === EXIF_POINTER_TAG) exifIfdOffset = readUint32(view, entryOffset + 8, littleEndian);
  }
  return exifIfdOffset === null ? null : readIfdDate(view, tiffOffset, tiffOffset + exifIfdOffset, littleEndian);
}

function readAsciiValue(view: DataView, tiffOffset: number, entryOffset: number, littleEndian: boolean) {
  const count = readUint32(view, entryOffset + 4, littleEndian);
  const valueOffset = count <= 4 ? entryOffset + 8 : tiffOffset + readUint32(view, entryOffset + 8, littleEndian);
  if (valueOffset + count > view.byteLength) return "";
  return ascii(view, valueOffset, count).replace(/\0+$/, "");
}

function parseExifDate(value: string) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function ascii(view: DataView, offset: number, length: number) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  return new TextDecoder("ascii").decode(bytes);
}

function readUint16(view: DataView, offset: number, littleEndian: boolean) {
  return view.getUint16(offset, littleEndian);
}

function readUint32(view: DataView, offset: number, littleEndian: boolean) {
  return view.getUint32(offset, littleEndian);
}
