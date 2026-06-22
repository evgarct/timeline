import { deleteEvent, getEvent, updateEvent } from "@/data/repository";
import { timelineEventSchema } from "@/domain/events";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const event = await getEvent(userId, (await params).id);
  return event ? Response.json(event) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = { ...(await request.json()), id: (await params).id };
  const parsed = timelineEventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await updateEvent(userId, parsed.data));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await deleteEvent(userId, (await params).id);
  return new Response(null, { status: 204 });
}

