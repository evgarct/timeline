import { getWeekPlan } from "@/data/week-plan-repository";
import { isValidTimeZone } from "@/domain/exercises";
import { getCurrentUserId } from "@/lib/current-user";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// The training week (Monday first): what is scheduled per day (template schedules), what was logged, and which days have
// no plan. `start` is any date in the wanted week (default: this week), `timezone` an IANA name (default UTC).
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const start = params.get("start") ?? undefined;
  const timezone = params.get("timezone") ?? "UTC";
  if (!isValidTimeZone(timezone)) return Response.json({ error: "invalid_timezone" }, { status: 400 });
  if (start !== undefined) {
    const parsed = new Date(`${start}T00:00:00Z`);
    if (!dateRegex.test(start) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== start) {
      return Response.json({ error: "invalid_start" }, { status: 400 });
    }
  }
  return Response.json(await getWeekPlan(userId, start, timezone));
}
