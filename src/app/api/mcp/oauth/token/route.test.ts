import { beforeEach, describe, expect, it, vi } from "vitest";
import { signCode } from "@/mcp/oauth";
import { createHash } from "node:crypto";

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

  it("exchanges valid authorization_code without PKCE", async () => {
    authenticateMcpToken.mockResolvedValue("user-1");
    const code = signCode({
      token: "ft_dev_valid_code",
      expiresAt: Date.now() + 60000,
    });

    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      access_token: "ft_dev_valid_code",
      token_type: "Bearer",
      scope: "mcp"
    });
  });

  it("exchanges valid authorization_code with PKCE S256", async () => {
    authenticateMcpToken.mockResolvedValue("user-1");
    const verifier = "some_random_verifier_string_12345678901234567890";
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    const code = signCode({
      token: "ft_dev_valid_pkce",
      expiresAt: Date.now() + 60000,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        code_verifier: verifier
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      access_token: "ft_dev_valid_pkce",
      token_type: "Bearer",
      scope: "mcp"
    });
  });

  it("rejects authorization_code with mismatching PKCE verifier", async () => {
    authenticateMcpToken.mockResolvedValue("user-1");
    const verifier = "some_random_verifier_string_12345678901234567890";
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    const code = signCode({
      token: "ft_dev_invalid_pkce",
      expiresAt: Date.now() + 60000,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        code_verifier: "wrong_verifier"
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toHaveProperty("error", "invalid_grant");
  });

  it("rejects expired authorization_code", async () => {
    authenticateMcpToken.mockResolvedValue("user-1");
    const code = signCode({
      token: "ft_dev_expired",
      expiresAt: Date.now() - 1000, // Expired 1 second ago
    });

    const { POST } = await import("./route");
    const request = new Request("https://form.example/api/mcp/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toHaveProperty("error", "invalid_grant");
  });
});

