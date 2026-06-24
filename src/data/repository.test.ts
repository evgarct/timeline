import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));
vi.mock("@/lib/r2", () => ({
  isR2Configured: true,
  createDownloadUrl: vi.fn(async (key: string) => `/signed/${key}`),
  deleteObjects: vi.fn()
}));

describe("memory event repository", () => {
  it("hydrates uploaded progress photo asset URLs in demo mode", async () => {
    vi.stubEnv("E2E_DEMO_MODE", "true");
    vi.resetModules();
    const media = await import("./media-repository");
    const repository = await import("./repository");

    await media.createPendingMediaAsset({
      id: "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a",
      userId: "demo-user",
      kind: "progress_photo",
      objectKey: "users/demo-user/progress/photo/full.jpg",
      thumbnailObjectKey: "users/demo-user/progress/photo/thumbnail.jpg",
      mimeType: "image/jpeg",
      originalFileName: "progress.jpg",
      width: 1200,
      height: 1600,
      sizeBytes: 100,
      thumbnailSizeBytes: 20
    });
    await media.markMediaAssetReady("demo-user", "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a");

    const saved = await repository.createEvent("demo-user", {
      id: "315db881-a742-45f6-a801-447808fffe6e",
      type: "progress_photo",
      occurredAt: new Date("2026-06-24T12:00:00.000Z"),
      timezone: "Europe/Prague",
      photos: [
        {
          id: "front",
          assetId: "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a",
          alt: "Progress photo"
        }
      ]
    });

    expect(saved.type).toBe("progress_photo");
    if (saved.type !== "progress_photo") return;
    expect(saved.photos[0]).toMatchObject({
      url: "/signed/users/demo-user/progress/photo/full.jpg",
      thumbnailUrl: "/signed/users/demo-user/progress/photo/thumbnail.jpg",
      width: 1200,
      height: 1600
    });

    const [latest] = await repository.listEvents("demo-user");
    expect(latest?.type).toBe("progress_photo");
    if (latest?.type !== "progress_photo") return;
    expect(latest.photos[0]?.url).toBe("/signed/users/demo-user/progress/photo/full.jpg");
  });
});

