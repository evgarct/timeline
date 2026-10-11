import { createFeedback, listFeedback } from "@/data/feedback-repository";
import { feedbackCategorySchema, feedbackInputSchema, feedbackStatusSchema } from "@/domain/feedback";
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

  // The body is only what the agent may say; where it came from is set by the transport. The WebMCP bridge sends
  // x-form-source / x-form-page from the page; a `source` or `page` field in the body is dropped by the schema.
  const parsed = feedbackInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const source = request.headers.get("x-form-source") === "webmcp" ? "webmcp" : "rest";
  const page = source === "webmcp" ? request.headers.get("x-form-page")?.slice(0, 300) || undefined : undefined;
  try {
    const { feedback, duplicate } = await createFeedback(userId, { ...parsed.data, source, page });
    return Response.json({ ...feedback, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (error) {
    return error instanceof Error && error.message === "rate_limited"
      ? Response.json({ error: "rate_limited" }, { status: 429 })
      : Response.json({ error: "feedback_failed" }, { status: 400 });
  }
}
