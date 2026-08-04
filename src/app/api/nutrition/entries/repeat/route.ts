import { z } from "zod";
import { getCurrentUserId } from "@/lib/current-user";
import { repeatMeal } from "@/data/nutrition-repository";
import { mealTypeSchema } from "@/domain/nutrition";

const repeatMealSchema = z.object({
  mealType: mealTypeSchema,
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1)
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = repeatMealSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await repeatMeal(userId, parsed.data), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "repeat_failed" }, { status: 400 });
  }
}
