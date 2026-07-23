import { authenticateMcpToken } from "@/mcp/server";

function clientCredentials(request: Request, form: FormData) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator >= 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1))
      };
    }
  }
  return {
    clientId: String(form.get("client_id") ?? ""),
    clientSecret: String(form.get("client_secret") ?? "")
  };
}

export async function POST(request: Request) {
  const form = await request.formData();
  if (form.get("grant_type") !== "client_credentials") {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const { clientId, clientSecret } = clientCredentials(request, form);
  if (clientId !== "form-personal" || !await authenticateMcpToken(clientSecret)) {
    return Response.json({ error: "invalid_client" }, { status: 401 });
  }

  return Response.json({
    access_token: clientSecret,
    token_type: "Bearer",
    scope: "mcp"
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
