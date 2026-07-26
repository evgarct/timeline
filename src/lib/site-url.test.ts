// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function loadSiteOrigin() {
  vi.resetModules();
  return (await import("./site-url")).siteOrigin;
}

describe("siteOrigin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses the explicit override when set, regardless of environment", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com/";
    const siteOrigin = await loadSiteOrigin();

    expect(siteOrigin()).toBe("https://staging.example.com");
  });

  it("falls back to the production domain when no Vercel environment is set (local dev/build)", async () => {
    const siteOrigin = await loadSiteOrigin();

    expect(siteOrigin()).toBe("https://form.safronov.dev");
  });

  it("falls back to the production domain on Vercel production", async () => {
    process.env.VERCEL_ENV = "production";
    const siteOrigin = await loadSiteOrigin();

    expect(siteOrigin()).toBe("https://form.safronov.dev");
  });

  it("uses the deployment's own URL on preview instead of the production domain", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "timeline-abc123-evgenii.vercel.app";
    const siteOrigin = await loadSiteOrigin();

    expect(siteOrigin()).toBe("https://timeline-abc123-evgenii.vercel.app");
  });

  it("throws on preview without either an override or VERCEL_URL", async () => {
    process.env.VERCEL_ENV = "preview";
    const siteOrigin = await loadSiteOrigin();

    expect(() => siteOrigin()).toThrow(/NEXT_PUBLIC_APP_URL must be set explicitly/);
  });
});
