import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMcpToken = vi.fn();

vi.mock("@/mcp/server", () => ({ authenticateMcpToken }));

describe("MCP OAuth token endpoint", () => {
  beforeEach(() => authenticateMcpToken.mockReset());

  it("exchanges a personal MCP secret with client_secret_post", async () => {
    authenticateMcpToken.mockResolvedValue("user-1");
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "form-personal",
        client_secret: "ft_dev_personal"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      access_token: "ft_dev_personal",
      token_type: "Bearer",
      scope: "mcp"
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects invalid client credentials", async () => {
    authenticateMcpToken.mockResolvedValue(null);
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "form-personal",
        client_secret: "invalid"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_client" });
  });
});
