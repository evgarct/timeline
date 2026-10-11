import { countFeedback } from "@/data/feedback-repository";
import { getCurrentUserId } from "@/lib/current-user";

// Exact counts for the Studio navigation badge, independent of the 200-entry cap of the list endpoint.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [newEntries, total] = await Promise.all([countFeedback(userId, "new"), countFeedback(userId)]);
  return Response.json({ new: newEntries, total });
}
