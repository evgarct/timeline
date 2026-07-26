// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadRoute(input?: { report?: { pdfObjectKey: string; expiresAt: Date; reportDate: string } | null; getObjectImpl?: () => Promise<unknown> }) {
  vi.resetModules();
  const getNutritionReport = vi.fn(async () => input?.report ?? null);
  const getObject = vi.fn(input?.getObjectImpl ?? (async () => {
    throw new Error("not configured for this test");
  }));

  vi.doMock("@/data/nutrition-report-repository", () => ({ getNutritionReport }));
  vi.doMock("@/lib/r2", () => ({ getObject, isR2Configured: true }));

  const route = await import("./route");
  return { GET: route.GET, getNutritionReport, getObject };
}

describe("GET /api/nutrition/reports/[id]/pdf", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the PDF bytes with the right headers when the report exists and hasn't expired", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const { GET } = await loadRoute({
      report: { pdfObjectKey: "key.pdf", expiresAt: new Date(Date.now() + 86_400_000), reportDate: "2026-07-25" },
      getObjectImpl: async () => ({
        ContentLength: body.byteLength,
        Body: { transformToWebStream: () => new ReadableStream({ start: (c) => { c.enqueue(body); c.close(); } }) }
      })
    });

    const response = await GET(new Request("https://timeline.test/api/nutrition/reports/abc/pdf"), { params: Promise.resolve({ id: "abc" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("nutrition-report-2026-07-25.pdf");
  });

  it("returns a friendly HTML page (not bare JSON) when the report is expired, for real visitors redirected here by middleware", async () => {
    const { GET } = await loadRoute({
      report: { pdfObjectKey: "key.pdf", expiresAt: new Date(Date.now() - 1000), reportDate: "2026-07-25" }
    });

    const response = await GET(new Request("https://timeline.test/api/nutrition/reports/abc/pdf"), { params: Promise.resolve({ id: "abc" }) });
    const text = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(text).toContain("Отчёт больше недоступен");
  });

  it("returns the same friendly HTML page when the report doesn't exist", async () => {
    const { GET } = await loadRoute({ report: null });

    const response = await GET(new Request("https://timeline.test/api/nutrition/reports/missing/pdf"), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});
