import { getExercise, getExerciseHistory } from "@/data/exercise-repository";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = (await params).id;
  if (!(await getExercise(userId, id))) return Response.json({ error: "not_found" }, { status: 404 });
  const limit = Math.min(50, Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "8", 10) || 8));
  return Response.json(await getExerciseHistory(userId, id, limit));
}
