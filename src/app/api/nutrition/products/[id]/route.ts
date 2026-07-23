import { getProduct } from "@/data/nutrition-repository";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const product = await getProduct(userId, (await params).id);
  return product ? Response.json(product) : Response.json({ error: "product_not_found" }, { status: 404 });
}
