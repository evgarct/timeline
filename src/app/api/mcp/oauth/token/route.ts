import { createHash } from "node:crypto";
import { authenticateMcpToken } from "@/mcp/server";
import { verifyCode } from "@/mcp/oauth";

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
  const grantType = form.get("grant_type");

  if (grantType === "client_credentials") {
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

  if (grantType === "authorization_code") {
    const code = form.get("code") as string;
    const codeVerifier = form.get("code_verifier") as string;

    if (!code) {
      return Response.json({ error: "invalid_request", error_description: "Missing code" }, { status: 400 });
    }

    const verified = verifyCode(code);
    if (!verified) {
      return Response.json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, { status: 400 });
    }

    // Verify PKCE if challenge was registered
    if (verified.code_challenge) {
      if (!codeVerifier) {
        return Response.json({ error: "invalid_grant", error_description: "Missing code_verifier for PKCE" }, { status: 400 });
      }

      let calculatedChallenge = codeVerifier;
      if (verified.code_challenge_method === "S256") {
        calculatedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
      }

      if (calculatedChallenge !== verified.code_challenge) {
        return Response.json({ error: "invalid_grant", error_description: "Invalid code_verifier" }, { status: 400 });
      }
    }

    // Verify that the token inside the authorization code is still active/valid in the database
    const userId = await authenticateMcpToken(verified.token);
    if (!userId) {
      return Response.json({ error: "invalid_grant", error_description: "Associated token has been revoked" }, { status: 400 });
    }

    return Response.json({
      access_token: verified.token,
      token_type: "Bearer",
      scope: "mcp"
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
}

