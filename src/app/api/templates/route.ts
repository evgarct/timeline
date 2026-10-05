import { listTemplates, upsertTemplate } from "@/data/workout-template-repository";
import { workoutTemplateInputSchema } from "@/domain/workout-templates";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return Response.json({ items: await listTemplates(userId, includeArchived) });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = workoutTemplateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await upsertTemplate(userId, parsed.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "template_save_failed";
    return Response.json({ error: message }, { status: message === "unknown_exercise" ? 422 : 400 });
  }
}
