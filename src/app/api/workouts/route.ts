import { getCurrentUserId } from "@/lib/current-user";
import { getWorkoutsForDate, recordWorkoutSession } from "@/data/exercise-repository";
import { recordWorkoutSessionInputSchema } from "@/domain/exercises";

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
