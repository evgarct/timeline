import { getFeedback, updateFeedback } from "@/data/feedback-repository";
import { feedbackUpdateSchema } from "@/domain/feedback";
import { getCurrentUserId } from "@/lib/current-user";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const entry = await getFeedback(userId, (await params).id);
  return entry ? Response.json(entry) : Response.json({ error: "not_found" }, { status: 404 });
}

// Triage: status and/or resolution note.
export async function PUT(request: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = feedbackUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = await updateFeedback(userId, (await params).id, parsed.data);
  return updated ? Response.json(updated) : Response.json({ error: "not_found" }, { status: 404 });
}
