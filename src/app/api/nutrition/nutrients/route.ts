import { aggregateNutrients, getFoodEntry, getProduct, listFoodEntries } from "@/data/nutrition-repository";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const entryId = url.searchParams.get("entryId");
  const date = url.searchParams.get("date");
  const timezone = url.searchParams.get("timezone");
  if (productId) {
    const product = await getProduct(userId, productId);
    return product ? Response.json(product.nutrientBases) : Response.json({ error: "product_not_found" }, { status: 404 });
  }
  if (entryId) {
    const entry = await getFoodEntry(userId, entryId);
    return entry ? Response.json(entry.productSnapshot.nutrients) : Response.json({ error: "entry_not_found" }, { status: 404 });
  }
  if (date && timezone) return Response.json(aggregateNutrients(await listFoodEntries(userId, date, timezone)));
  return Response.json({ error: "scope_required" }, { status: 400 });
}
