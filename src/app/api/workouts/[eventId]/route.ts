import { deleteWorkoutSession, getWorkoutSession, replaceWorkoutSession } from "@/data/exercise-repository";
import { recordWorkoutSessionInputSchema } from "@/domain/exercises";
import { getCurrentUserId } from "@/lib/current-user";

type Context = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const session = await getWorkoutSession(userId, (await params).eventId);
  return session ? Response.json(session) : Response.json({ error: "not_found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = recordWorkoutSessionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const session = await replaceWorkoutSession(userId, (await params).eventId, parsed.data);
    return session ? Response.json(session) : Response.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "workout_save_failed";
    return Response.json({ error: message }, { status: message === "unknown_exercise" ? 422 : 400 });
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return (await deleteWorkoutSession(userId, (await params).eventId))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "not_found" }, { status: 404 });
}
