import { z } from "zod";
import { getCurrentUserId } from "@/lib/current-user";
import { listDailyActivity, upsertDailyActivity } from "@/data/daily-activity-repository";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const submitDailyActivitySchema = z.object({
  activityDate: z.string().regex(dateRegex),
  timezone: z.string().min(1),
  steps: z.number().int().min(0),
  goalSteps: z.number().int().min(0),
  distanceMeters: z.number().int().min(0).nullable().optional(),
  weeklyAverage: z.number().int().min(0).nullable().optional(),
  workoutCount: z.number().int().min(0).optional(),
  workoutSummary: z
    .array(
      z.object({
        kind: z.string(),
        durationSeconds: z.number().int().min(0),
        caloriesKcal: z.number().min(0).nullable().optional()
      })
    )
    .nullable()
    .optional()
});

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
    return Response.json({ error: "from_and_to_required" }, { status: 400 });
  }

  return Response.json(await listDailyActivity(userId, from, to));
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = submitDailyActivitySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const row = await upsertDailyActivity({ userId, ...parsed.data });
  return Response.json(row, { status: 201 });
}
