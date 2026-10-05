import { getCurrentUserId } from "@/lib/current-user";
import { getWorkoutsForDate, listRecentWorkoutSessions, recordWorkoutSession } from "@/data/exercise-repository";
import { isValidTimeZone, recordWorkoutSessionInputSchema } from "@/domain/exercises";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const timezone = url.searchParams.get("timezone");
  if (!date && !timezone) {
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    return Response.json({ sessions: await listRecentWorkoutSessions(userId, limit) });
  }
  if (!date || !dateRegex.test(date) || !timezone) {
    return Response.json({ error: "date_and_timezone_required" }, { status: 400 });
  }
  // The regex accepts shapes like 2026-99-01; require a real calendar date and a real IANA zone.
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || !isValidTimeZone(timezone)) {
    return Response.json({ error: "invalid_date_or_timezone" }, { status: 400 });
  }

  const sessions = await getWorkoutsForDate(userId, date, timezone);
  return Response.json({ date, sessions });
}

// Idempotent on idempotencyKey: a client retrying after a dropped connection gets the stored session.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = recordWorkoutSessionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await recordWorkoutSession(userId, parsed.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "workout_save_failed";
    return Response.json({ error: message }, { status: message === "unknown_exercise" ? 422 : 400 });
  }
}
