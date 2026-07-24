import { describe, expect, it, vi } from "vitest";

const storeMcpClient = vi.fn();

vi.mock("@/data/repository", () => ({ storeMcpClient }));

describe("MCP OAuth dynamic client registration", () => {
  it("registers a client with https redirect_uris", async () => {
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        client_name: "Claude",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.client_id).toMatch(/^mcp_client_/);
    expect(body.redirect_uris).toEqual(["https://claude.ai/api/mcp/auth_callback"]);
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(storeMcpClient).toHaveBeenCalledWith(body.client_id, ["https://claude.ai/api/mcp/auth_callback"], "Claude");
  });

  it("rejects registration without redirect_uris", async () => {
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("rejects registration with a non-https redirect_uri", async () => {
    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://evil.example/callback"] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
