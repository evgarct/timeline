import { randomBytes } from "node:crypto";
import { storeMcpClient } from "@/data/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, { status: 400 });
  }

  const metadata = (body ?? {}) as Record<string, unknown>;
  const redirectUris = metadata.redirect_uris;

  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every(isAllowedRedirectUri)) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris must be a non-empty array of https URLs" },
      { status: 400 }
    );
  }

  const clientName = typeof metadata.client_name === "string" ? metadata.client_name : undefined;
  const clientId = `mcp_client_${randomBytes(16).toString("base64url")}`;

  await storeMcpClient(clientId, redirectUris, clientName);

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      client_name: clientName,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"]
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
