import { z } from "zod";
import { getCurrentUserId } from "@/lib/current-user";
import { listFoodEntries, recordFood } from "@/data/nutrition-repository";
import { foodQuantitySchema, mealTypeSchema, productInputSchema } from "@/domain/nutrition";

const recordFoodSchema = z.object({
  productId: z.string().uuid().optional(),
  product: productInputSchema.optional(),
  mealType: mealTypeSchema,
  quantity: foodQuantitySchema,
  occurredAt: z.coerce.date(),
  timezone: z.string().min(1),
  note: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(1).max(200)
}).refine((value) => Boolean(value.productId) !== Boolean(value.product), {
  message: "Provide exactly one of productId or product"
});

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const timezone = url.searchParams.get("timezone");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !timezone) {
    return Response.json({ error: "date_and_timezone_required" }, { status: 400 });
  }
  try {
    return Response.json(await listFoodEntries(userId, date, timezone));
  } catch {
    return Response.json({ error: "invalid_timezone" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = recordFoodSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await recordFood(userId, parsed.data), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "entry_save_failed" }, { status: 400 });
  }
}
