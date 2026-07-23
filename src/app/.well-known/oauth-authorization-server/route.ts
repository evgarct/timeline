export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    issuer: origin,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    scopes_supported: ["mcp"]
  });
}
