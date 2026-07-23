import { describe, expect, it, vi } from "vitest";

vi.mock("@/data/repository", () => ({
  storeMcpToken: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("demo-user"),
  getCurrentUserId: vi.fn().mockResolvedValue("demo-user"),
}));

vi.mock("@/lib/auth/server", () => ({
  isNeonAuthConfigured: false,
}));

vi.mock("@/mcp/server", () => ({
  authenticateMcpToken: vi.fn().mockResolvedValue("demo-user"),
}));

vi.mock("@/mcp/oauth", () => ({
  hashToken: vi.fn((t) => t),
  signCode: vi.fn(() => "mocked-auth-code"),
}));

describe("MCP OAuth authorize endpoint", () => {
  it("accepts form-personal client_id in GET", async () => {
    const { GET } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/authorize?client_id=form-personal&redirect_uri=https://chatgpt.com/callback&response_type=code");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Подключение к ChatGPT");
  });

  it("accepts HTTPS URL client_id in GET", async () => {
    const { GET } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/authorize?client_id=https://chatgpt.com/ext/client-id&redirect_uri=https://chatgpt.com/callback&response_type=code");
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it("rejects invalid client_id in GET", async () => {
    const { GET } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/authorize?client_id=invalid-client&redirect_uri=https://chatgpt.com/callback&response_type=code");
    const response = await GET(request);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid client_id");
  });

  it("accepts HTTPS URL client_id in POST", async () => {
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/authorize?client_id=https://chatgpt.com/ext/client-id&redirect_uri=https://chatgpt.com/callback&response_type=code", {
      method: "POST",
      body: new URLSearchParams({
        action: "auto_authorize",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://chatgpt.com/callback?code=mocked-auth-code");
  });

  it("rejects invalid client_id in POST", async () => {
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/authorize?client_id=invalid-client&redirect_uri=https://chatgpt.com/callback&response_type=code", {
      method: "POST",
      body: new URLSearchParams({
        action: "auto_authorize",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid OAuth request parameters");
  });
});
