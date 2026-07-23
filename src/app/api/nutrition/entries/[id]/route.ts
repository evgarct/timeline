import { z } from "zod";
import { deleteFoodEntry, getFoodEntry, updateFoodEntry } from "@/data/nutrition-repository";
import { foodQuantitySchema, mealTypeSchema } from "@/domain/nutrition";
import { getCurrentUserId } from "@/lib/current-user";

const updateSchema = z.object({
  mealType: mealTypeSchema.optional(),
  quantity: foodQuantitySchema.optional(),
  occurredAt: z.coerce.date().optional(),
  timezone: z.string().min(1).optional(),
  note: z.string().max(2000).nullable().optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const entry = await getFoodEntry(userId, (await params).id);
  return entry ? Response.json(entry) : Response.json({ error: "entry_not_found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const changes = { ...parsed.data, note: parsed.data.note ?? undefined };
    return Response.json(await updateFoodEntry(userId, (await params).id, changes));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "entry_update_failed" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  await deleteFoodEntry(userId, (await params).id);
  return new Response(null, { status: 204 });
}
