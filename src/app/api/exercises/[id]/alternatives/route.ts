import { listExerciseAlternatives } from "@/data/exercise-repository";
import { getCurrentUserId } from "@/lib/current-user";

// Replacement candidates: same first primary muscle, ranked by movement pattern then equipment.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const limit = Math.min(30, Math.max(1, Number.parseInt(query.get("limit") ?? "10", 10) || 10));
  const found = await listExerciseAlternatives(userId, (await params).id, { equipment: query.get("equipment") ?? undefined, limit });
  return found ? Response.json(found) : Response.json({ error: "not_found" }, { status: 404 });
}
