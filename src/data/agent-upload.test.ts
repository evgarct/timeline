import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const stored = new Map<string, { size: number; type: string }>();
vi.mock("@/lib/r2", () => ({
  isR2Configured: true,
  putObject: async (key: string, body: Uint8Array, type: string) => { stored.set(key, { size: body.byteLength, type }); }
}));

const userId = "photo-owner";

let upload: typeof import("./agent-upload");
let media: typeof import("./media-repository");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://form.example.test");
  vi.resetModules();
  upload = await import("./agent-upload");
  media = await import("./media-repository");
});

beforeEach(() => stored.clear());

const picture = () => sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 90, b: 160 } } }).jpeg().toBuffer();
const tokenOf = (uploadUrl: string) => uploadUrl.split("/").pop() as string;

describe("agent photo upload", () => {
  it("issues a link, ingests a picture once and leaves a ready asset with real sizes", async () => {
    const link = await upload.createAgentUploadLink(userId, { fileName: "front.jpg" });
    expect(link.uploadUrl.startsWith("https://form.example.test/api/uploads/agent/")).toBe(true);
    expect(link.maxBytes).toBe(4_000_000);

    const done = await upload.ingestAgentUpload(tokenOf(link.uploadUrl), await picture());
    expect(done).toMatchObject({ assetId: link.assetId, width: 300, height: 200 });
    if (done.kind !== "progress_photo") throw new Error("expected a photo result");
    expect(done.palette.background).toMatch(/^#[0-9a-f]{6}$/);
    expect([...stored.values()].every((object) => object.type === "image/jpeg")).toBe(true);
    expect(stored.size).toBe(2);

    const asset = await media.getMediaAsset(userId, link.assetId);
    expect(asset).toMatchObject({ status: "ready", width: 300, height: 200 });
    expect(asset?.sizeBytes).toBeLessThan(4_000_000);

    // a link works once
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), await picture())).rejects.toMatchObject({ code: "asset_unavailable" });
  });

  it("lets only one of two concurrent uploads to the same link write", async () => {
    const link = await upload.createAgentUploadLink(userId, {});
    const token = tokenOf(link.uploadUrl);
    const results = await Promise.allSettled([
      upload.ingestAgentUpload(token, await picture()),
      upload.ingestAgentUpload(token, await picture())
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ code: "asset_unavailable" });
    expect(stored.size).toBe(2); // one full + one thumbnail, written once
  });

  it("names HEIC explicitly instead of a generic invalid-image error", async () => {
    const link = await upload.createAgentUploadLink(userId, {});
    const heic = new TextEncoder().encode("\0\0\0\u0018ftypheic\0\0\0\0");
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), heic)).rejects.toMatchObject({ code: "unsupported_heic" });
  });

  it("refuses a forged token, an empty body, an oversized body and bytes that are not a picture", async () => {
    const link = await upload.createAgentUploadLink(userId, {});
    await expect(upload.ingestAgentUpload("forged.token", await picture())).rejects.toMatchObject({ code: "invalid_token" });
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), new Uint8Array())).rejects.toMatchObject({ code: "empty_body" });
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), new Uint8Array(4_000_001))).rejects.toMatchObject({ code: "payload_too_large" });
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), new TextEncoder().encode("hello"))).rejects.toMatchObject({ code: "invalid_image" });
    expect(stored.size).toBe(0);
    // the failed attempts did not use up the link
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), await picture())).resolves.toMatchObject({ assetId: link.assetId });
  });
});

describe("agent InBody original upload", () => {
  const pdf = () => new TextEncoder().encode("%PDF-1.4\n% fabricated sheet\n%%EOF");

  it("stores a PDF byte for byte, keeps its extension and records the sniffed type", async () => {
    const link = await upload.createAgentUploadLink(userId, { kind: "inbody", fileName: "inbody-2026-06-20.pdf" });
    expect(link.kind).toBe("inbody");
    const bytes = pdf();
    const done = await upload.ingestAgentUpload(tokenOf(link.uploadUrl), bytes);
    expect(done).toEqual({ kind: "inbody", assetId: link.assetId, mimeType: "application/pdf", sizeBytes: bytes.byteLength });

    expect(stored.size).toBe(1);
    const [[key, object]] = [...stored.entries()];
    expect(key).toMatch(/\/inbody\/.+\/original\.pdf$/);
    expect(object).toEqual({ size: bytes.byteLength, type: "application/pdf" });
    const asset = await media.getMediaAsset(userId, link.assetId);
    expect(asset).toMatchObject({ kind: "inbody", status: "ready", mimeType: "application/pdf", sizeBytes: bytes.byteLength, width: null });
    expect(asset?.thumbnailObjectKey).toBeNull();
  });

  it("keeps a JPEG exactly as sent (no re-encoding) and works once per link", async () => {
    const link = await upload.createAgentUploadLink(userId, { kind: "inbody", fileName: "sheet.jpg" });
    const jpeg = new Uint8Array(await picture());
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), jpeg)).resolves.toMatchObject({ mimeType: "image/jpeg", sizeBytes: jpeg.byteLength });
    expect([...stored.values()][0].size).toBe(jpeg.byteLength);
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), jpeg)).rejects.toMatchObject({ code: "asset_unavailable" });
  });

  it("refuses bytes that are not a supported file without using up the link", async () => {
    const link = await upload.createAgentUploadLink(userId, { kind: "inbody" });
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), new TextEncoder().encode("hello"))).rejects.toMatchObject({ code: "unsupported_file" });
    expect(stored.size).toBe(0);
    await expect(upload.ingestAgentUpload(tokenOf(link.uploadUrl), pdf())).resolves.toMatchObject({ assetId: link.assetId });
  });
});
