import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const validProgressRequest = {
  kind: "progress_photo",
  fileName: "progress.jpg",
  sourceSize: 1234,
  sourceMimeType: "image/jpeg",
  full: {
    size: 1000,
    width: 1200,
    height: 1600
  },
  thumbnail: {
    size: 200
  }
};

async function loadRoute(input?: {
  userId?: string | null;
  isR2Configured?: boolean;
  quota?: { usedBytes: number; limitBytes: number | null };
}) {
  vi.resetModules();
  const createPendingMediaAsset = vi.fn(async (asset: object) => asset);
  const getStorageQuota = vi.fn(async () => input?.quota ?? { usedBytes: 0, limitBytes: 250 * 1024 * 1024 });
  const createUploadUrl = vi.fn(async (key: string) => `https://uploads.example/${key}`);

  vi.doMock("@/data/media-repository", () => ({ createPendingMediaAsset }));
  vi.doMock("@/data/storage-repository", () => ({ getStorageQuota }));
  vi.doMock("@/lib/current-user", () => ({
    getCurrentUserId: vi.fn(async () => (
      Object.hasOwn(input ?? {}, "userId") ? input?.userId : "user-1"
    ))
  }));
  vi.doMock("@/lib/r2", () => ({
    isR2Configured: input?.isR2Configured ?? true,
    createUploadUrl
  }));

  const route = await import("./route");
  return { POST: route.POST, createPendingMediaAsset, getStorageQuota, createUploadUrl };
}

function jsonRequest(body: unknown) {
  return new Request("https://timeline.test/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/uploads/presign", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a pending progress asset and returns upload URLs when quota allows it", async () => {
    const { POST, createPendingMediaAsset, getStorageQuota, createUploadUrl } = await loadRoute();

    const response = await POST(jsonRequest(validProgressRequest));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(getStorageQuota).toHaveBeenCalledWith("user-1");
    expect(createPendingMediaAsset).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      kind: "progress_photo",
      mimeType: "image/jpeg",
      originalFileName: "progress.jpg",
      width: 1200,
      height: 1600,
      sizeBytes: 1000,
      thumbnailSizeBytes: 200
    }));
    expect(createUploadUrl).toHaveBeenCalledTimes(2);
    expect(body.assetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.uploads).toEqual([
      expect.objectContaining({ role: "full", contentType: "image/jpeg" }),
      expect.objectContaining({ role: "thumbnail", contentType: "image/jpeg" })
    ]);
  });

  it("rejects uploads before creating media when storage quota would be exceeded", async () => {
    const { POST, createPendingMediaAsset, createUploadUrl } = await loadRoute({
      quota: { usedBytes: 900, limitBytes: 1024 }
    });

    const response = await POST(jsonRequest(validProgressRequest));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "storage_quota_exceeded" });
    expect(createPendingMediaAsset).not.toHaveBeenCalled();
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it("returns 503 when storage is not configured", async () => {
    const { POST, getStorageQuota, createPendingMediaAsset } = await loadRoute({ isR2Configured: false });

    const response = await POST(jsonRequest(validProgressRequest));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "storage_not_configured" });
    expect(getStorageQuota).not.toHaveBeenCalled();
    expect(createPendingMediaAsset).not.toHaveBeenCalled();
  });

  it("returns 401 before storage or database work when the user is not authenticated", async () => {
    const { POST, getStorageQuota, createPendingMediaAsset } = await loadRoute({ userId: null });

    const response = await POST(jsonRequest(validProgressRequest));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(getStorageQuota).not.toHaveBeenCalled();
    expect(createPendingMediaAsset).not.toHaveBeenCalled();
  });
});
