import { AgentUploadError, ingestAgentUpload } from "@/data/agent-upload";
import { MAX_AGENT_UPLOAD_BYTES } from "@/domain/media";

const statusByCode: Record<string, number> = {
  storage_not_configured: 503,
  invalid_token: 401,
  asset_unavailable: 409,
  payload_too_large: 413,
  invalid_image: 422,
  unsupported_heic: 415,
  empty_body: 400
};

// The link's token is the credential (it names one asset and one user and expires), so any origin may call this with
// no cookies: that is what lets an agent upload from a page on another site.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AGENT_UPLOAD_BYTES) return json({ error: "payload_too_large", maxBytes: MAX_AGENT_UPLOAD_BYTES }, 413);
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    return json(await ingestAgentUpload((await params).token, bytes), 201);
  } catch (error) {
    if (error instanceof AgentUploadError) return json({ error: error.code, ...(error.code === "payload_too_large" ? { maxBytes: MAX_AGENT_UPLOAD_BYTES } : {}) }, statusByCode[error.code] ?? 400);
    throw error;
  }
}
