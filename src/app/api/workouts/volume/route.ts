import { getMuscleVolume } from "@/data/exercise-repository";
import { isValidTimeZone } from "@/domain/exercises";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const timezone = params.get("timezone") ?? "UTC";
  if (!isValidTimeZone(timezone)) return Response.json({ error: "invalid_timezone" }, { status: 400 });
  const weeks = Math.min(12, Math.max(1, Number.parseInt(params.get("weeks") ?? "4", 10) || 4));
  return Response.json({ weeks: await getMuscleVolume(userId, weeks, timezone) });
}
