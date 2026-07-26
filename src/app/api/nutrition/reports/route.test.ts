// @vitest-environment node
// jsdom's FormData/File brand-checks reject the runtime's own File instances (a known jsdom/undici
// interop gap) — this route is server-only and needs no DOM, so it runs in the plain Node environment.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function loadRoute(input?: { userId?: string | null; isR2Configured?: boolean }) {
  vi.resetModules();
  const createNutritionReport = vi.fn(async (report: object) => report);
  const putObject = vi.fn(async () => undefined);

  vi.doMock("@/data/nutrition-report-repository", () => ({ createNutritionReport }));
  vi.doMock("@/lib/current-user", () => ({
    getCurrentUserId: vi.fn(async () => (
      Object.hasOwn(input ?? {}, "userId") ? input?.userId : "user-1"
    ))
  }));
  vi.doMock("@/lib/r2", () => ({
    isR2Configured: input?.isR2Configured ?? true,
    putObject
  }));

  const route = await import("./route");
  return { POST: route.POST, createNutritionReport, putObject };
}

function multipartRequest(overrides?: { reportDate?: string; timezone?: string; skipPdf?: boolean; skipOgImage?: boolean; pdfSize?: number }) {
  const form = new FormData();
  if (!overrides?.skipPdf) {
    form.set("pdf", new File([new Uint8Array(overrides?.pdfSize ?? 12)], "report.pdf", { type: "application/pdf" }));
  }
  if (!overrides?.skipOgImage) {
    form.set("ogImage", new File([new Uint8Array(8)], "og.jpg", { type: "image/jpeg" }));
  }
  form.set("reportDate", overrides?.reportDate ?? "2026-07-25");
  form.set("timezone", overrides?.timezone ?? "Europe/Prague");
  return new Request("https://timeline.test/api/nutrition/reports", { method: "POST", body: form });
}

describe("POST /api/nutrition/reports", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads the pdf and og image and returns the public share URL", async () => {
    const { POST, createNutritionReport, putObject } = await loadRoute();

    const response = await POST(multipartRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(putObject).toHaveBeenCalledTimes(2);
    expect(createNutritionReport).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      reportDate: "2026-07-25",
      timezone: "Europe/Prague"
    }));
    expect(body.reportId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.shareUrl).toBe(`https://form.safronov.dev/r/${body.reportId}`);
  });

  it("rejects a malformed report date", async () => {
    const { POST, createNutritionReport } = await loadRoute();

    const response = await POST(multipartRequest({ reportDate: "07/25/2026" }));

    expect(response.status).toBe(400);
    expect(createNutritionReport).not.toHaveBeenCalled();
  });

  it("rejects a request missing the pdf part", async () => {
    const { POST, createNutritionReport } = await loadRoute();

    const response = await POST(multipartRequest({ skipPdf: true }));

    expect(response.status).toBe(400);
    expect(createNutritionReport).not.toHaveBeenCalled();
  });

  it("returns 503 when storage is not configured", async () => {
    const { POST, createNutritionReport } = await loadRoute({ isR2Configured: false });

    const response = await POST(multipartRequest());

    expect(response.status).toBe(503);
    expect(createNutritionReport).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    const { POST, createNutritionReport } = await loadRoute({ userId: null });

    const response = await POST(multipartRequest());

    expect(response.status).toBe(401);
    expect(createNutritionReport).not.toHaveBeenCalled();
  });
});
