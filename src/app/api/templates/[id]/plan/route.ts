import { planTemplate } from "@/data/workout-template-repository";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const plan = await planTemplate(userId, (await params).id);
  return plan ? Response.json(plan) : Response.json({ error: "not_found" }, { status: 404 });
}
