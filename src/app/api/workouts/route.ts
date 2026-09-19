import { getCurrentUserId } from "@/lib/current-user";
import { getWorkoutsForDate } from "@/data/exercise-repository";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const timezone = url.searchParams.get("timezone");
  if (!date || !dateRegex.test(date) || !timezone) {
    return Response.json({ error: "date_and_timezone_required" }, { status: 400 });
  }

  const sessions = await getWorkoutsForDate(userId, date, timezone);
  return Response.json({ date, sessions });
}
