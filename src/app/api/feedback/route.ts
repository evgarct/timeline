import { createFeedback, listFeedback } from "@/data/feedback-repository";
import { feedbackCategorySchema, feedbackCreateSchema, feedbackStatusSchema } from "@/domain/feedback";
import { getCurrentUserId } from "@/lib/current-user";

// Feedback agents leave about the tools they use. Newest first; filters: status, category, tool, limit (1-200).
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const category = params.get("category");
  const parsedStatus = status ? feedbackStatusSchema.safeParse(status) : undefined;
  const parsedCategory = category ? feedbackCategorySchema.safeParse(category) : undefined;
  if ((parsedStatus && !parsedStatus.success) || (parsedCategory && !parsedCategory.success)) {
    return Response.json({ error: "invalid_filter" }, { status: 400 });
  }
  const limit = Math.min(200, Math.max(1, Number.parseInt(params.get("limit") ?? "50", 10) || 50));
  return Response.json({
    items: await listFeedback(userId, { status: parsedStatus?.data, category: parsedCategory?.data, tool: params.get("tool") ?? undefined, limit })
  });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = feedbackCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const { feedback, duplicate } = await createFeedback(userId, parsed.data);
    return Response.json({ ...feedback, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (error) {
    return error instanceof Error && error.message === "rate_limited"
      ? Response.json({ error: "rate_limited" }, { status: 429 })
      : Response.json({ error: "feedback_failed" }, { status: 400 });
  }
}
