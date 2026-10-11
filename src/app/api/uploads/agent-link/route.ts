import { AgentUploadError, createAgentUploadLink } from "@/data/agent-upload";
import { agentUploadLinkSchema } from "@/domain/media";
import { getCurrentUserId } from "@/lib/current-user";

const statusByCode: Record<string, number> = { storage_not_configured: 503, storage_quota_exceeded: 413 };

// Reserves a progress-photo asset for an agent and returns the one-time link to POST the picture bytes to.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = agentUploadLinkSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await createAgentUploadLink(userId, parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof AgentUploadError) return Response.json({ error: error.code }, { status: statusByCode[error.code] ?? 400 });
    throw error;
  }
}
