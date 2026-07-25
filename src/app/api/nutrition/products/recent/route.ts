import { getCurrentUserId } from "@/lib/current-user";
import { recentProductsForMeal } from "@/data/nutrition-repository";
import { mealTypeSchema } from "@/domain/nutrition";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const mealType = mealTypeSchema.safeParse(url.searchParams.get("mealType"));
  if (!mealType.success) return Response.json({ error: "meal_type_required" }, { status: 400 });
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  return Response.json(await recentProductsForMeal(userId, mealType.data, page, pageSize));
}
