import { searchExercises, upsertExerciseDetailed } from "@/data/exercise-repository";
import { exerciseInputSchema } from "@/domain/exercises";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") ?? "30", 10) || 30));
  const found = await searchExercises(
    userId, params.get("query") ?? "", page, pageSize, params.get("includeArchived") === "true",
    {
      muscle: params.get("muscle") ?? undefined,
      equipment: params.get("equipment") ?? undefined,
      movementPattern: params.get("movementPattern") ?? undefined
    }
  );
  // Technique steps stay behind GET /api/exercises/{id}: a page of 30 hits with full instructions is mostly dead weight.
  return Response.json({ ...found, items: found.items.map(({ instructions: _instructions, ...item }) => ({ ...item, hasInstructions: Boolean(_instructions?.length) })) });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = exerciseInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const { exercise, created, matchedBy, changedFields } = await upsertExerciseDetailed(userId, parsed.data);
    return Response.json({ ...exercise, created, matchedBy, changedFields }, { status: created ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "exercise_save_failed";
    return Response.json({ error: message }, { status: message === "ambiguous_exercise" ? 409 : 400 });
  }
}
