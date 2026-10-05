import { getExercise, upsertExercise } from "@/data/exercise-repository";
import { exerciseInputSchema } from "@/domain/exercises";
import { getCurrentUserId } from "@/lib/current-user";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const exercise = await getExercise(userId, (await params).id);
  return exercise ? Response.json(exercise) : Response.json({ error: "not_found" }, { status: 404 });
}

// Full replace of the editable fields (same shape as POST); also the way to archive/unarchive.
export async function PUT(request: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = (await params).id;
  if (!(await getExercise(userId, id))) return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = exerciseInputSchema.safeParse({ ...(await request.json().catch(() => ({}))), id });
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await upsertExercise(userId, parsed.data));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "exercise_save_failed" }, { status: 400 });
  }
}
