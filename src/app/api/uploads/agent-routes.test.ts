import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));
vi.mock("@/lib/r2", () => ({ isR2Configured: true, putObject: async () => undefined }));
vi.mock("@/lib/current-user", () => ({ getCurrentUserId: async () => "route-owner" }));

let link: typeof import("./agent-link/route");
let ingest: typeof import("./agent/[token]/route");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://form.example.test");
  vi.resetModules();
  link = await import("./agent-link/route");
  ingest = await import("./agent/[token]/route");
});

const picture = () => sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 80, b: 40 } } }).png().toBuffer();
const post = (token: string, body: BodyInit | null, headers: Record<string, string> = {}) =>
  ingest.POST(new Request(`https://form.example.test/api/uploads/agent/${token}`, { method: "POST", body, headers }), { params: Promise.resolve({ token }) });

describe("agent upload routes", () => {
  it("creates a link and accepts the picture from any origin without cookies", async () => {
    const created = await link.POST(new Request("https://form.example.test/api/uploads/agent-link", { method: "POST", body: JSON.stringify({ fileName: "a.png" }) }));
    expect(created.status).toBe(201);
    const { uploadUrl, assetId } = await created.json() as { uploadUrl: string; assetId: string };

    const preflight = ingest.OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");

    const response = await post(uploadUrl.split("/").pop() as string, new Uint8Array(await picture()));
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.json()).toMatchObject({ assetId, width: 64, height: 48 });
  });

  it("answers with clear errors: bad token 401, too large 413, not a picture 422", async () => {
    expect((await post("forged.token", new Uint8Array(await picture()))).status).toBe(401);

    const created = await link.POST(new Request("https://form.example.test/api/uploads/agent-link", { method: "POST", body: "{}" }));
    const token = ((await created.json()) as { uploadUrl: string }).uploadUrl.split("/").pop() as string;
    const tooLarge = await post(token, null, { "content-length": "5000000" });
    expect(tooLarge.status).toBe(413);
    expect(await tooLarge.json()).toMatchObject({ error: "payload_too_large", maxBytes: 4_000_000 });
    expect((await post(token, "definitely not an image")).status).toBe(422);
  });
});
