import { getLastQuantityForProduct } from "@/data/nutrition-repository";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const quantity = await getLastQuantityForProduct(userId, (await params).id);
  return Response.json({ quantity: quantity ?? null });
}
