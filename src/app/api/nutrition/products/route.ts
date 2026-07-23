import { getCurrentUserId } from "@/lib/current-user";
import { searchProducts, upsertProduct } from "@/data/nutrition-repository";
import { productInputSchema } from "@/domain/nutrition";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 30)));
  return Response.json(await searchProducts(userId, query, page, pageSize));
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = productInputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await upsertProduct(userId, parsed.data), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "product_save_failed" }, { status: 400 });
  }
}
